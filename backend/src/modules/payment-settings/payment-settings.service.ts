/**
 * Payment-settings service. Pure business logic, no req/res.
 *
 * Two ownership scopes share one table:
 *   1. The **platform default** — a single row where `invoiceId` is null.
 *      All invoices fall back to it when no per-invoice override exists.
 *      The at-most-one-platform-default invariant is enforced here (singleton
 *      upsert), not in the DB.
 *   2. The **invoice override** — a row where `invoiceId` is set. One per
 *      invoice (enforced by `@@unique`).
 */
import { PaymentSetting, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { NotFoundError, ValidationError } from '@/lib/errors';
import {
  PlatformDefaultInput,
  InvoiceOverrideInput,
} from './payment-settings.validators';

/**
 * Validate the input for its method/provider combo. Throws ValidationError
 * if a required field is missing or a forbidden one is set.
 */
function assertValidForMethod(input: {
  paymentMethod: 'mobile_money' | 'bank';
  mobileMoneyProvider?: string | null;
  bankName?: string | null;
}): void {
  if (input.paymentMethod === 'mobile_money') {
    if (!input.mobileMoneyProvider) {
      throw new ValidationError('mobileMoneyProvider is required when paymentMethod is mobile_money');
    }
    if (input.bankName) {
      throw new ValidationError('bankName must not be set when paymentMethod is mobile_money');
    }
  } else {
    if (!input.bankName) {
      throw new ValidationError('bankName is required when paymentMethod is bank');
    }
    if (input.mobileMoneyProvider) {
      throw new ValidationError('mobileMoneyProvider must not be set when paymentMethod is bank');
    }
  }
}

/**
 * Normalize account number for mobile_money (E.164). For bank, store as-is
 * since account numbers come in many formats.
 */
function normalizeAccountNumber(
  paymentMethod: 'mobile_money' | 'bank',
  accountNumber: string,
): string {
  if (paymentMethod === 'mobile_money') {
    try {
      return normalizePhone(accountNumber);
    } catch {
      throw new ValidationError('Mobile money account number must be a valid E.164 phone number');
    }
  }
  return accountNumber.trim();
}

function buildData(
  input: PlatformDefaultInput | InvoiceOverrideInput,
  createdById: string,
  scope: { invoiceId: string | null; groupId: string | null },
): Prisma.PaymentSettingUncheckedCreateInput {
  return {
    invoiceId: scope.invoiceId,
    groupId: scope.groupId,
    paymentMethod: input.paymentMethod,
    mobileMoneyProvider: input.mobileMoneyProvider ?? null,
    bankName: input.bankName ?? null,
    accountName: input.accountName.trim(),
    accountNumber: normalizeAccountNumber(input.paymentMethod, input.accountNumber),
    reference: input.reference ?? null,
    createdById,
  };
}

// ---------- Platform default (singleton) ----------

export async function getPlatformDefault(): Promise<PaymentSetting | null> {
  return prisma.paymentSetting.findFirst({ where: { invoiceId: null } });
}

export async function upsertPlatformDefault(
  input: PlatformDefaultInput,
  createdById: string,
): Promise<PaymentSetting> {
  assertValidForMethod(input);
  const data = buildData(input, createdById, { invoiceId: null, groupId: null });
  const existing = await prisma.paymentSetting.findFirst({ where: { invoiceId: null } });
  if (existing) {
    return prisma.paymentSetting.update({ where: { id: existing.id }, data });
  }
  return prisma.paymentSetting.create({ data });
}

// ---------- Invoice overrides ----------

export async function getByInvoice(invoiceId: string): Promise<PaymentSetting | null> {
  return prisma.paymentSetting.findUnique({ where: { invoiceId } });
}

export async function upsertInvoiceOverride(
  invoiceId: string,
  input: InvoiceOverrideInput,
  createdById: string,
): Promise<PaymentSetting> {
  // Verify the invoice exists — return 404 if not, so the admin gets a
  // clear error instead of a foreign-key violation.
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new NotFoundError('Invoice');

  assertValidForMethod(input);
  const data = buildData(input, createdById, { invoiceId, groupId: null });
  const existing = await prisma.paymentSetting.findUnique({ where: { invoiceId } });
  if (existing) {
    return prisma.paymentSetting.update({ where: { id: existing.id }, data });
  }
  return prisma.paymentSetting.create({ data });
}

/**
 * Resolve the effective payment details for an invoice: override if set,
 * else the platform default. Resolved in a single query (OR clause).
 * Returns null if neither is set (e.g. fresh install before seed).
 */
export async function getEffectiveForInvoice(
  invoiceId: string,
): Promise<PaymentSetting | null> {
  // First the override (unique by invoiceId); if present, return it.
  const override = await prisma.paymentSetting.findUnique({ where: { invoiceId } });
  if (override) return override;
  // Fall back to the platform default.
  return prisma.paymentSetting.findFirst({ where: { invoiceId: null } });
}

// ---------- Group contribution payment (per ROSCA) ----------

export async function getByGroup(groupId: string): Promise<PaymentSetting | null> {
  return prisma.paymentSetting.findFirst({ where: { groupId } });
}

export async function upsertGroupPayment(
  groupId: string,
  input: PlatformDefaultInput,
  createdById: string,
): Promise<PaymentSetting> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundError('Group');

  assertValidForMethod(input);
  const data = buildData(input, createdById, { invoiceId: null, groupId });
  const existing = await prisma.paymentSetting.findFirst({ where: { groupId } });
  if (existing) {
    return prisma.paymentSetting.update({ where: { id: existing.id }, data });
  }
  return prisma.paymentSetting.create({ data });
}

/** Customer-facing payment details for cycle contributions (group → platform fallback). */
export interface ContributionPaymentDetails {
  paymentMethod: 'mobile_money' | 'bank';
  mobileMoneyProvider: 'mtn' | 'airtel' | 'zamtel' | null;
  bankName: string | null;
  accountName: string;
  accountNumber: string;
  reference: string | null;
  isOverride: boolean;
}

function toContributionDetails(
  setting: PaymentSetting,
  isOverride: boolean,
): ContributionPaymentDetails {
  return {
    paymentMethod: setting.paymentMethod,
    mobileMoneyProvider: setting.mobileMoneyProvider,
    bankName: setting.bankName,
    accountName: setting.accountName,
    accountNumber: setting.accountNumber,
    reference: setting.reference,
    isOverride,
  };
}

export async function getContributionPaymentDetails(
  groupId?: string,
): Promise<ContributionPaymentDetails | null> {
  if (groupId) {
    const groupSetting = await getByGroup(groupId);
    if (groupSetting) return toContributionDetails(groupSetting, true);
  }
  const platform = await getPlatformDefault();
  if (!platform) return null;
  return toContributionDetails(platform, false);
}
