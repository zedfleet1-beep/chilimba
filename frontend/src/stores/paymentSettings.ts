/**
 * Payment-settings Pinia store. Holds the platform default + actions to
 * read/write it. Per-invoice overrides are accessed directly via the API
 * (they're not stored in the global store).
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as api from '@/api/paymentSettings';
import type { PaymentSettingRow, PaymentSettingInput } from '@/api/paymentSettings';
import { getErrorMessage } from '@/api/client';

export const usePaymentSettingsStore = defineStore('paymentSettings', () => {
  const platform = ref<PaymentSettingRow | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchPlatform() {
    loading.value = true;
    error.value = null;
    try {
      platform.value = await api.getPlatformDefault();
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function savePlatform(input: PaymentSettingInput) {
    error.value = null;
    try {
      platform.value = await api.upsertPlatformDefault(input);
      return platform.value;
    } catch (e) {
      error.value = getErrorMessage(e);
      throw e;
    }
  }

  return { platform, loading, error, fetchPlatform, savePlatform };
});
