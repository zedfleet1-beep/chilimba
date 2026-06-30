/**
 * Admin invoices store — full list, filter state, current invoice detail.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import * as invoicesApi from '@/api/invoices';
import { getErrorMessage } from '@/api/client';

export const useAdminInvoicesStore = defineStore('adminInvoices', () => {
  const invoices = ref<invoicesApi.Invoice[]>([]);
  const current = ref<invoicesApi.Invoice | null>(null);
  const filter = ref<{ status: invoicesApi.InvoiceStatus | 'all' }>({ status: 'all' });
  const loading = ref(false);
  const error = ref<string | null>(null);

  const filtered = computed(() =>
    filter.value.status === 'all'
      ? invoices.value
      : invoices.value.filter((i) => i.status === filter.value.status),
  );

  async function fetchAll() {
    loading.value = true;
    error.value = null;
    try {
      const params =
        filter.value.status === 'all' ? undefined : { status: filter.value.status };
      invoices.value = await invoicesApi.listInvoices(params);
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function createInvoice(input: invoicesApi.CreateInvoiceInput) {
    error.value = null;
    try {
      return await invoicesApi.createInvoice(input);
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
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

  async function approve(popId: string): Promise<invoicesApi.ApprovePopResult | null> {
    try {
      const result = await invoicesApi.approvePop(popId);
      // Refresh the current invoice
      if (current.value) {
        current.value = await invoicesApi.getInvoice(current.value.id);
      }
      return result;
    } catch (e) {
      error.value = getErrorMessage(e);
      return null;
    }
  }

  async function recordCash(notes?: string): Promise<invoicesApi.ApprovePopResult | null> {
    if (!current.value) return null;
    try {
      const result = await invoicesApi.recordCashPayment(current.value.id, notes);
      current.value = await invoicesApi.getInvoice(current.value.id);
      return result;
    } catch (e) {
      error.value = getErrorMessage(e);
      return null;
    }
  }

  async function reject(popId: string, reason: string) {
    try {
      await invoicesApi.rejectPop(popId, reason);
      if (current.value) {
        current.value = await invoicesApi.getInvoice(current.value.id);
      }
    } catch (e) {
      error.value = getErrorMessage(e);
    }
  }

  return {
    invoices,
    current,
    filter,
    loading,
    error,
    filtered,
    fetchAll,
    fetchOne,
    createInvoice,
    approve,
    recordCash,
    reject,
  };
});
