/**
 * Invoice service. Pure business logic, no req/res.
 *
 * Money rule: `amountNgwe` is always BigInt. We cast at the boundary from
 * the validated `number` input and never coerce to Number for arithmetic.
 *
 * POP upload flow (Week 4 update): the server streams the file buffer to
 * Cloudinary and stores only the secure URL + public_id in the DB. The
 * frontend no longer does a two-step presigned-PUT roundtrip — the file
 * goes through the backend in one multipart POST.
 */
import {
  Prisma,
  Invoice,
  PaymentProof,
  PaymentSetting,
  InvoiceStatus,
  PaymentProofStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { sendWhatsApp } from '@/lib/whatsapp';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import { logger } from '@/lib/logger';
import { env } from '@/env';
import {
  uploadBufferToCloudinary,
  destroyAsset,
  resourceTypeForMime,
  isCloudinaryConfigured,
  type CloudinaryResourceType,
} from '@/lib/cloudinary';
import { signGroupCreationToken } from '@/lib/jwt';
import { invoiceCreatedTemplate, popApprovedTemplate } from './templates/invoice-pop.templates';
import {
  CreateInvoiceInput,
  ListInvoicesQuery,
} from './invoices.validators';

const MAX_INVOICE_NUMBER_RETRIES = 3;

export interface PopUploadResult {
  paymentProof: PaymentProof;
}

export interface RecordCashPaymentResult {
  invoice: Invoice;
  paymentProof: PaymentProof;
  groupCreationToken: string;
  groupCreationLink: string;
}

/**
 * Flattened payment details returned to the customer. Either from the
 * per-invoice override or the platform default — they don't care which.
 */
export interface PaymentDetails {
  paymentMethod: 'mobile_money' | 'bank';
  mobileMoneyProvider: 'mtn' | 'airtel' | 'zamtel' | null;
  bankName: string | null;
  accountName: string;
  accountNumber: string;
  reference: string | null;
  /** True when the row is the per-invoice override; false when it's the platform default. */
  isOverride: boolean;
}

/**
 * Resolve the effective payment details for an invoice: override if set,
 * else the platform default. Returns null when neither is set.
 */
async function getEffectivePaymentDetails(
  invoiceId: string,
  tx?: Prisma.TransactionClient,
): Promise<PaymentDetails | null> {
  const client = (tx ?? prisma) as typeof prisma;
  const override = await client.paymentSetting.findUnique({ where: { invoiceId } });
  if (override) return toPaymentDetails(override, true);
  const platform = await client.paymentSetting.findFirst({ where: { invoiceId: null } });
  if (platform) return toPaymentDetails(platform, false);
  return null;
}

function toPaymentDetails(row: PaymentSetting, isOverride: boolean): PaymentDetails {
  return {
    paymentMethod: row.paymentMethod,
    mobileMoneyProvider: row.mobileMoneyProvider,
    bankName: row.bankName,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    reference: row.reference,
    isOverride,
  };
}

/**
 * Create an invoice and notify the customer via WhatsApp.
 * Generates `INV####` (zero-padded) by SELECT MAX inside a transaction;
 * retries on P2002 to absorb the rare race.
 */
export async function createInvoice(
  input: CreateInvoiceInput,
  createdById: string,
): Promise<Invoice> {
  const phone = normalizePhone(input.phone);
  const amountNgwe = BigInt(input.amountNgwe);

  const { invoice } = await createInvoiceWithSequentialNumber({
    customerName: input.customerName.trim(),
    phone,
    email: input.email ?? null,
    amountNgwe,
    description: input.description ?? null,
    createdById,
  });

  // Best-effort WhatsApp. Don't block the admin response on a send failure.
  sendWhatsApp(
    phone,
    invoiceCreatedTemplate({
      name: firstNameFromCustomerName(invoice.customerName),
      invoiceNumber: invoice.invoiceNumber,
      amountNgwe: invoice.amountNgwe,
      description: invoice.description,
      webBaseUrl: env.WEB_BASE_URL,
    }),
  ).catch((e) => logger.warn({ err: e.message, invoiceId: invoice.id }, 'invoice WhatsApp enqueue failed'));

  return invoice;
}

async function createInvoiceWithSequentialNumber(data: {
  customerName: string;
  phone: string;
  email: string | null;
  amountNgwe: bigint;
  description: string | null;
  createdById: string;
}): Promise<{ invoice: Invoice }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_RETRIES; attempt++) {
    try {
      const invoice = await prisma.$transaction(async (tx) => {
        const last = await tx.invoice.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { invoiceNumber: true },
        });
        const nextNumber = nextInvoiceNumber(last?.invoiceNumber);
        return tx.invoice.create({
          data: {
            invoiceNumber: nextNumber,
            customerName: data.customerName,
            phone: data.phone,
            email: data.email,
            amountNgwe: data.amountNgwe,
            description: data.description,
            createdById: data.createdById,
            status: InvoiceStatus.pending,
          },
        });
      });
      return { invoice };
    } catch (err) {
      lastError = err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Another writer beat us to the same number. Retry.
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to allocate an invoice number after retries');
}

function nextInvoiceNumber(prev: string | undefined): string {
  if (!prev) return 'INV0001';
  const m = /^INV(\d+)$/.exec(prev);
  const next = m ? Number(m[1]) + 1 : 1;
  return `INV${String(next).padStart(4, '0')}`;
}

function firstNameFromCustomerName(full: string): string {
  const trimmed = full.trim();
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first || 'there';
}

/**
 * List invoices (super_admin). Supports simple filters.
 */
export async function listInvoices(query: ListInvoicesQuery): Promise<Invoice[]> {
  const where: Prisma.InvoiceWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.customerPhone) {
    try {
      where.phone = normalizePhone(query.customerPhone);
    } catch {
      // ignore — leave unfiltered
    }
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.from);
    if (query.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.to);
  }
  return prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' } });
}

/**
 * Fetch a single invoice with its POPs. super_admin sees any invoice;
 * customers only see invoices tied to their phone number.
 * Embeds the effective paymentDetails (override → platform default).
 */
export async function getInvoice(
  id: string,
  requesterUserId: string,
): Promise<Invoice & { paymentProofs: PaymentProof[]; paymentDetails: PaymentDetails | null }> {
  const requester = await prisma.user.findUniqueOrThrow({ where: { id: requesterUserId } });
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { paymentProofs: { orderBy: { createdAt: 'desc' } } },
  });
  if (!invoice) throw new NotFoundError('Invoice');

  assertInvoiceAccess(requester, invoice.phone);

  const paymentDetails = await getEffectivePaymentDetails(id);
  return { ...invoice, paymentDetails };
}

/**
 * Invoices for the caller's phone (matched, not by userId — the customer
 * might not be a registered user yet). Embeds paymentDetails on each row.
 */
export async function getMyInvoices(
  requesterUserId: string,
): Promise<Array<Invoice & { paymentDetails: PaymentDetails | null }>> {
  const requester = await prisma.user.findUniqueOrThrow({ where: { id: requesterUserId } });
  if (!requester.phone) return [];
  const phone = normalizePhone(requester.phone);
  const invoices = await prisma.invoice.findMany({
    where: { phone },
    orderBy: { createdAt: 'desc' },
    include: { paymentProofs: { orderBy: { createdAt: 'desc' } } },
  });
  return Promise.all(
    invoices.map(async (inv) => ({
      ...inv,
      paymentDetails: await getEffectivePaymentDetails(inv.id),
    })),
  );
}

/**
 * Server-proxied POP upload. The frontend POSTs the file as
 * `multipart/form-data`; multer puts it in `req.file.buffer`; we stream
 * the buffer to Cloudinary and persist the resulting public_id +
 * secure_url in `payment_proofs`.
 *
 * If Cloudinary succeeds but the DB insert fails, we destroy the orphan
 * asset so we never leak storage. Mirrors the cleanup pattern in
 * `car-fleet-management-backend/src/controllers/expenseController.js`.
 */
export async function uploadPop(
  invoiceId: string,
  file: { buffer: Buffer; mimetype: string; originalname?: string; size: number },
  requesterUserId: string,
): Promise<PopUploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new ConflictError(
      'CLOUDINARY_NOT_CONFIGURED' as never,
      'File storage is not configured on the server. Contact the admin.',
    );
  }
  const requester = await prisma.user.findUniqueOrThrow({ where: { id: requesterUserId } });
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice');
  assertInvoiceAccess(requester, invoice.phone);
  if (invoice.status !== InvoiceStatus.pending) {
    throw new ConflictError(
      'INVOICE_NOT_PENDING' as never,
      'This invoice is no longer accepting POPs',
    );
  }

  const fileType = mimeToFileType(file.mimetype);
  const resourceType: CloudinaryResourceType = resourceTypeForMime(file.mimetype);

  // 1. Stream the buffer to Cloudinary. We do this BEFORE inserting the DB
  //    row so we can destroy the asset on any downstream failure.
  const upload = await uploadBufferToCloudinary(file.buffer, {
    folder: 'chilimba/payment_proofs',
  });

  // 2. Insert the payment_proofs row. On any failure here, clean up the
  //    Cloudinary asset.
  try {
    const paymentProof = await prisma.paymentProof.create({
      data: {
        invoiceId,
        uploadedById: requester.id,
        fileKey: upload.publicId,
        fileUrl: upload.secureUrl,
        resourceType: upload.resourceType,
        fileType,
        status: 'pending',
      },
    });
    return { paymentProof };
  } catch (err) {
    await destroyAsset(upload.publicId, resourceType);
    throw err;
  }
}

/**
 * Admin records an in-person cash payment. Marks the invoice paid, creates an
 * approved payment_proof audit row, and sends the group-creation WhatsApp.
 */
export async function recordCashPayment(
  invoiceId: string,
  reviewerId: string,
  notes?: string,
): Promise<RecordCashPaymentResult> {
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Invoice');
    if (invoice.status !== InvoiceStatus.pending) {
      throw new ConflictError(
        'INVOICE_NOT_PENDING' as never,
        'This invoice is no longer pending',
      );
    }

    const now = new Date();
    await tx.paymentProof.updateMany({
      where: { invoiceId, status: PaymentProofStatus.pending },
      data: {
        status: PaymentProofStatus.rejected,
        reviewedById: reviewerId,
        reviewedAt: now,
        notes: 'Superseded by cash payment recorded by admin',
      },
    });

    const paymentProof = await tx.paymentProof.create({
      data: {
        invoiceId,
        uploadedById: reviewerId,
        fileKey: `cash/${invoiceId}`,
        fileUrl: null,
        resourceType: null,
        fileType: 'pdf',
        status: PaymentProofStatus.approved,
        reviewedById: reviewerId,
        reviewedAt: now,
        notes: notes?.trim() || 'Cash payment recorded by admin',
      },
    });
    const updatedInvoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.paid, paidAt: now },
    });
    return { paymentProof, invoice: updatedInvoice };
  });

  const groupCreationToken = signGroupCreationToken({
    invoiceId: result.invoice.id,
    phone: result.invoice.phone,
  });
  const groupCreationLink = `${env.WEB_BASE_URL}/create-group?token=${encodeURIComponent(groupCreationToken)}`;

  sendWhatsApp(
    result.invoice.phone,
    popApprovedTemplate({
      name: firstNameFromCustomerName(result.invoice.customerName),
      invoiceNumber: result.invoice.invoiceNumber,
      groupCreationLink,
    }),
  ).catch((e) =>
    logger.warn({ err: e.message, invoiceId: result.invoice.id }, 'cash-payment WhatsApp enqueue failed'),
  );

  return {
    invoice: result.invoice,
    paymentProof: result.paymentProof,
    groupCreationToken,
    groupCreationLink,
  };
}

function assertInvoiceAccess(
  requester: { role: string; phone: string | null },
  invoicePhone: string,
): void {
  if (requester.role === 'super_admin') return;
  if (!requester.phone) {
    throw new ForbiddenError('You do not have access to this invoice');
  }
  const phone = normalizePhone(requester.phone);
  if (phone !== invoicePhone) {
    throw new ForbiddenError('You do not have access to this invoice');
  }
}

function mimeToFileType(mimetype: string): 'jpg' | 'png' | 'pdf' {
  switch (mimetype) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
    case 'image/webp':
    case 'image/heic':
      return 'png';
    case 'application/pdf':
      return 'pdf';
    default:
      // Should be caught by the multer fileFilter upstream.
      throw new ConflictError(
        'UNSUPPORTED_FILE_TYPE' as never,
        `Unsupported file type: ${mimetype}`,
      );
  }
}
