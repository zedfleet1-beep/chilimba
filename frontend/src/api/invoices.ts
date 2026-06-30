/**
 * Invoice + POP API client. Typed wrappers around the shared `api` axios
 * instance. Mirrors backend/src/modules/invoices.
 */
import { api } from './client';
import type { PaymentDetails } from '@/lib/payment';

export type InvoiceStatus = 'pending' | 'paid' | 'cancelled';
export type PopStatus = 'pending' | 'approved' | 'rejected';
export type FileType = 'jpg' | 'png' | 'pdf';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  phone: string;
  email: string | null;
  amountNgwe: string; // bigint as string (JSON has no BigInt)
  status: InvoiceStatus;
  description: string | null;
  createdById: string | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  paymentProofs?: PaymentProof[];
  /** Effective payment details (override → platform default). null when neither is set. */
  paymentDetails?: PaymentDetails | null;
}

export interface PaymentProof {
  id: string;
  invoiceId: string;
  uploadedById: string;
  /** Cloudinary public_id (or local key for legacy rows). */
  fileKey: string;
  /** Cloudinary secure_url — what the admin sees in the preview. */
  fileUrl: string | null;
  /** 'image' for JPG/PNG, 'raw' for PDF. */
  resourceType: string | null;
  fileType: FileType;
  status: PopStatus;
  reviewedById: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateInvoiceInput {
  customerName: string;
  phone: string;
  email?: string;
  amountNgwe: number;
  description?: string;
}

// ---------- Admin ----------

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const { data } = await api.post<{ success: true; data: Invoice }>('/invoices', input);
  return data.data;
}

export async function listInvoices(params?: {
  status?: InvoiceStatus;
  from?: string;
  to?: string;
  customerPhone?: string;
}): Promise<Invoice[]> {
  const { data } = await api.get<{ success: true; data: Invoice[] }>('/invoices', { params });
  return data.data;
}

export async function getInvoice(id: string): Promise<Invoice & { paymentProofs: PaymentProof[] }> {
  const { data } = await api.get<{ success: true; data: Invoice & { paymentProofs: PaymentProof[] } }>(
    `/invoices/${id}`,
  );
  return data.data;
}

// ---------- Customer ----------

export async function getMyInvoices(): Promise<Invoice[]> {
  const { data } = await api.get<{ success: true; data: Invoice[] }>('/invoices/mine');
  return data.data;
}

/**
 * Upload a POP to the backend. The file is sent as multipart/form-data
 * under the field name `file`. The backend streams it to Cloudinary and
 * stores only the secure URL + public_id in the DB.
 */
export async function uploadPop(
  invoiceId: string,
  file: File,
): Promise<PaymentProof> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ success: true; data: PaymentProof }>(
    `/invoices/${invoiceId}/pop`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

// ---------- Admin: approve / reject / refresh ----------

export interface ApprovePopResult {
  invoice: Invoice;
  paymentProof: PaymentProof;
  groupCreationToken: string;
  groupCreationLink: string;
}

export async function recordCashPayment(
  invoiceId: string,
  notes?: string,
): Promise<ApprovePopResult> {
  const { data } = await api.post<{ success: true; data: ApprovePopResult }>(
    `/invoices/${invoiceId}/record-cash`,
    notes ? { notes } : {},
  );
  return data.data;
}

export async function approvePop(popId: string): Promise<ApprovePopResult> {
  const { data } = await api.post<{ success: true; data: ApprovePopResult }>(
    `/admin/pops/${popId}/approve`,
    {},
  );
  return data.data;
}

export async function rejectPop(popId: string, reason: string): Promise<PaymentProof> {
  const { data } = await api.post<{ success: true; data: PaymentProof }>(
    `/admin/pops/${popId}/reject`,
    { reason },
  );
  return data.data;
}

export async function refreshPopDownloadUrl(popId: string): Promise<{ url: string; expiresIn: number }> {
  const { data } = await api.post<{ success: true; data: { url: string; expiresIn: number } }>(
    `/payment-proofs/${popId}/refresh-url`,
  );
  return data.data;
}
