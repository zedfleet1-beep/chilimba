/**
 * Payment-settings API client. Typed wrappers around the shared `api`
 * axios instance. Mirrors backend/src/modules/payment-settings.
 */
import { api } from './client';
import type { PaymentDetails } from '@/lib/payment';

// The backend's PaymentSetting row flattened.
export interface PaymentSettingRow extends PaymentDetails {
  id: string;
  invoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSettingInput {
  paymentMethod: 'mobile_money' | 'bank';
  mobileMoneyProvider?: 'mtn' | 'airtel' | 'zamtel';
  bankName?: string;
  accountName: string;
  accountNumber: string;
  reference?: string;
}

// ---------- Platform default ----------

export async function getPlatformDefault(): Promise<PaymentSettingRow | null> {
  const { data } = await api.get<{ success: true; data: PaymentSettingRow | null }>(
    '/payment-settings/platform',
  );
  return data.data;
}

export async function upsertPlatformDefault(input: PaymentSettingInput): Promise<PaymentSettingRow> {
  const { data } = await api.put<{ success: true; data: PaymentSettingRow }>(
    '/payment-settings/platform',
    input,
  );
  return data.data;
}

// ---------- Per-invoice override ----------

export async function getByInvoice(invoiceId: string): Promise<PaymentSettingRow | null> {
  const { data } = await api.get<{ success: true; data: PaymentSettingRow | null }>(
    `/payment-settings/by-invoice/${invoiceId}`,
  );
  return data.data;
}

export async function upsertInvoiceOverride(
  invoiceId: string,
  input: PaymentSettingInput,
): Promise<PaymentSettingRow> {
  const { data } = await api.put<{ success: true; data: PaymentSettingRow }>(
    `/payment-settings/by-invoice/${invoiceId}`,
    input,
  );
  return data.data;
}

export async function getEffectiveForInvoice(invoiceId: string): Promise<PaymentSettingRow | null> {
  const { data } = await api.get<{ success: true; data: PaymentSettingRow | null }>(
    '/payment-settings/effective',
    { params: { invoiceId } },
  );
  return data.data;
}
