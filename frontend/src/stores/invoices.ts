/**
 * Invoices store — customer-side. Holds the caller's invoices and the
 * in-flight state for the POP upload flow.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as invoicesApi from '@/api/invoices';
import { getErrorMessage } from '@/api/client';

export const useInvoicesStore = defineStore('invoices', () => {
  const invoices = ref<invoicesApi.Invoice[]>([]);
  const current = ref<invoicesApi.Invoice | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const uploading = ref(false);

  const pending = computed(() => invoices.value.filter((i) => i.status === 'pending'));
  const paid = computed(() => invoices.value.filter((i) => i.status === 'paid'));

  async function fetchMine() {
    loading.value = true;
    error.value = null;
    try {
      invoices.value = await invoicesApi.getMyInvoices();
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchOne(id: string) {
    loading.value = true;
    error.value = null;
    try {
      current.value = await invoicesApi.getInvoice(id);
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Upload a POP. The file is sent to the backend as multipart, which
   * streams it to Cloudinary. The backend returns the created POP with
   * the Cloudinary secure_url.
   */
  async function uploadPop(invoiceId: string, file: File): Promise<invoicesApi.PaymentProof | null> {
    uploading.value = true;
    error.value = null;
    try {
      const pop = await invoicesApi.uploadPop(invoiceId, file);
      if (current.value && current.value.id === invoiceId) {
        current.value = await invoicesApi.getInvoice(invoiceId);
      }
      return pop;
    } catch (e) {
      error.value = getErrorMessage(e, 'Upload failed');
      return null;
    } finally {
      uploading.value = false;
    }
  }

  return { invoices, current, loading, error, uploading, pending, paid, fetchMine, fetchOne, uploadPop };
});
