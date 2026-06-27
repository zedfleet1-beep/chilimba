<script setup lang="ts">
import { ref } from 'vue';
import { usePaymentSettingsStore } from '@/stores/paymentSettings';
import { X } from 'lucide-vue-next';
import { getErrorMessage } from '@/api/client';
import PaymentSettingsForm from '@/components/PaymentSettingsForm.vue';
import type { PaymentSettingInput, PaymentSettingRow } from '@/api/paymentSettings';

const props = defineProps<{ initial?: PaymentSettingRow }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const store = usePaymentSettingsStore();
const submitting = ref(false);
const localError = ref('');

async function onSubmit(input: PaymentSettingInput) {
  localError.value = '';
  submitting.value = true;
  try {
    await store.savePlatform(input);
    emit('saved');
  } catch (e) {
    localError.value = getErrorMessage(e);
  } finally {
    submitting.value = false;
  }
}

function toFormInitial(): Partial<PaymentSettingInput> | undefined {
  if (!props.initial) return undefined;
  return {
    paymentMethod: props.initial.paymentMethod,
    mobileMoneyProvider: props.initial.mobileMoneyProvider ?? undefined,
    bankName: props.initial.bankName ?? undefined,
    accountName: props.initial.accountName,
    accountNumber: props.initial.accountNumber,
    reference: props.initial.reference ?? undefined,
  };
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40">
    <div class="bg-white rounded-2xl shadow-xl border border-warm-100 w-full max-w-md p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-display text-lg font-semibold text-slate-900">Edit payment default</h3>
        <button class="text-slate-500 hover:text-slate-700" @click="emit('close')" aria-label="Close">
          <X class="w-5 h-5" />
        </button>
      </div>
      <p v-if="localError" class="text-sm text-red-600 mb-3">{{ localError }}</p>
      <PaymentSettingsForm
        :initial="toFormInitial()"
        :submitting="submitting"
        @submit="onSubmit"
        @cancel="emit('close')"
      />
    </div>
  </div>
</template>
