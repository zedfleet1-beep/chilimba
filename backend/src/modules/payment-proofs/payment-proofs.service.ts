/**
 * Payment-proofs service. Admin reviews a POP uploaded by a customer:
 * approve → mark invoice paid + mint a 48h group-creation token;
 * reject  → mark POP rejected with a reason and let the customer re-upload.
 */
import { Invoice, PaymentProof, InvoiceStatus, PaymentProofStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signGroupCreationToken } from '@/lib/jwt';
import { sendWhatsApp } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';
import { env } from '@/env';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { popApprovedTemplate, popRejectedTemplate } from '@/modules/invoices/templates/invoice-pop.templates';

export interface ApprovePopResult {
  invoice: Invoice;
  paymentProof: PaymentProof;
  groupCreationToken: string;
  groupCreationLink: string;
}

/**
 * Approve a POP. In a single transaction:
 *   1. POP → status='approved', reviewedById, reviewedAt
 *   2. Invoice → status='paid', paidAt
 * Then mint a 48h signed JWT and enqueue the WhatsApp.
 */
export async function approvePop(
  popId: string,
  reviewerId: string,
): Promise<ApprovePopResult> {
  const result = await prisma.$transaction(async (tx) => {
    const pop = await tx.paymentProof.findUnique({
      where: { id: popId },
      include: { invoice: true },
    });
    if (!pop) throw new NotFoundError('Payment proof');
    if (pop.status !== PaymentProofStatus.pending) {
      throw new ConflictError('POP_ALREADY_REVIEWED' as never, 'This POP has already been reviewed');
    }
    if (pop.invoice.status !== InvoiceStatus.pending) {
      throw new ConflictError(
        'INVOICE_NOT_PENDING' as never,
        `Cannot approve a POP for an invoice in status ${pop.invoice.status}`,
      );
    }

    const now = new Date();
    const updatedPop = await tx.paymentProof.update({
      where: { id: pop.id },
      data: { status: PaymentProofStatus.approved, reviewedById: reviewerId, reviewedAt: now },
    });
    const updatedInvoice = await tx.invoice.update({
      where: { id: pop.invoiceId },
      data: { status: InvoiceStatus.paid, paidAt: now },
    });
    return { paymentProof: updatedPop, invoice: updatedInvoice };
  });

  const groupCreationToken = signGroupCreationToken({
    invoiceId: result.invoice.id,
    phone: result.invoice.phone,
  });
  const groupCreationLink = `${env.WEB_BASE_URL}/create-group?token=${encodeURIComponent(groupCreationToken)}`;

  // Best-effort WhatsApp.
  sendWhatsApp(
    result.invoice.phone,
    popApprovedTemplate({
      name: firstNameFromCustomerName(result.invoice.customerName),
      invoiceNumber: result.invoice.invoiceNumber,
      groupCreationLink,
    }),
  ).catch((e) =>
    logger.warn({ err: e.message, invoiceId: result.invoice.id }, 'pop-approved WhatsApp enqueue failed'),
  );

  return {
    invoice: result.invoice,
    paymentProof: result.paymentProof,
    groupCreationToken,
    groupCreationLink,
  };
}

/**
 * Reject a POP. The invoice stays pending so the customer can re-upload.
 */
export async function rejectPop(
  popId: string,
  reviewerId: string,
  reason: string,
): Promise<PaymentProof> {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('A reason is required to reject a POP');
  }
  const result = await prisma.$transaction(async (tx) => {
    const pop = await tx.paymentProof.findUnique({
      where: { id: popId },
      include: { invoice: true },
    });
    if (!pop) throw new NotFoundError('Payment proof');
    if (pop.status !== PaymentProofStatus.pending) {
      throw new ConflictError('POP_ALREADY_REVIEWED' as never, 'This POP has already been reviewed');
    }
    const updated = await tx.paymentProof.update({
      where: { id: pop.id },
      data: {
        status: PaymentProofStatus.rejected,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        notes: reason,
      },
    });
    return { pop: updated, invoice: pop.invoice };
  });

  sendWhatsApp(
    result.invoice.phone,
    popRejectedTemplate({
      name: firstNameFromCustomerName(result.invoice.customerName),
      invoiceNumber: result.invoice.invoiceNumber,
      reason,
      webBaseUrl: env.WEB_BASE_URL,
    }),
  ).catch((e) =>
    logger.warn({ err: e.message, invoiceId: result.invoice.id }, 'pop-rejected WhatsApp enqueue failed'),
  );

  return result.pop;
}

/**
 * Issue a short-lived download URL for a POP image (admin preview).
 * Now backed by Cloudinary: returns the stored secure_url for images
 * (already publicly viewable) and a signed `private_download_url` for
 * PDFs. The DB only stores the URL, not the file itself.
 */
export async function getPopDownloadUrl(
  popId: string,
  requesterUserId: string,
): Promise<{ url: string; expiresIn: number }> {
  const requester = await prisma.user.findUniqueOrThrow({ where: { id: requesterUserId } });
  const pop = await prisma.paymentProof.findUnique({
    where: { id: popId },
    include: { invoice: true },
  });
  if (!pop) throw new NotFoundError('Payment proof');

  if (requester.role !== 'super_admin') {
    if (requester.phone !== pop.invoice.phone) {
      throw new ForbiddenError('You cannot view this POP');
    }
  }
  // Images: the stored secure_url is a public CDN URL — return as-is.
  // PDFs (raw): sign it with a short-lived private_download_url so we
  // don't leak the receipt. Falls back to the stored URL if signing fails.
  if (pop.resourceType === 'raw' && pop.fileKey) {
    try {
      const { v2: cloudinary } = await import('cloudinary');
      const isConfigured = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET,
      );
      if (isConfigured) {
        const url = cloudinary.utils.private_download_url(pop.fileKey, 'pdf', {
          resource_type: 'raw',
          type: 'upload',
          expires_at: Math.floor(Date.now() / 1000) + 600,
        });
        return { url, expiresIn: 600 };
      }
    } catch {
      // Fall through to the stored URL.
    }
  }
  return { url: pop.fileUrl ?? '', expiresIn: 600 };
}

function firstNameFromCustomerName(full: string): string {
  const trimmed = full.trim();
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first || 'there';
}
