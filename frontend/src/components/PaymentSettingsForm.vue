<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { PaymentSettingInput } from '@/api/paymentSettings';

const props = defineProps<{
  initial?: Partial<PaymentSettingInput>;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  submit: [input: PaymentSettingInput];
  cancel: [];
}>();

const paymentMethod = ref<'mobile_money' | 'bank'>(props.initial?.paymentMethod ?? 'mobile_money');
const mobileMoneyProvider = ref<'mtn' | 'airtel' | 'zamtel'>(
  props.initial?.mobileMoneyProvider ?? 'mtn',
);
const bankName = ref(props.initial?.bankName ?? '');
const accountName = ref(props.initial?.accountName ?? '');
const accountNumber = ref(props.initial?.accountNumber ?? '');
const reference = ref(props.initial?.reference ?? '');
const localError = ref('');

watch(
  () => props.initial,
  (v) => {
    if (!v) return;
    if (v.paymentMethod) paymentMethod.value = v.paymentMethod;
    if (v.mobileMoneyProvider) mobileMoneyProvider.value = v.mobileMoneyProvider;
    if (v.bankName !== undefined) bankName.value = v.bankName ?? '';
    if (v.accountName !== undefined) accountName.value = v.accountName ?? '';
    if (v.accountNumber !== undefined) accountNumber.value = v.accountNumber ?? '';
    if (v.reference !== undefined) reference.value = v.reference ?? '';
  },
);

const isMobileMoney = computed(() => paymentMethod.value === 'mobile_money');

function onSubmit() {
  localError.value = '';
  if (!accountName.value.trim() || !accountNumber.value.trim()) {
    localError.value = 'Account name and account number are required';
    return;
  }
  if (isMobileMoney.value && !mobileMoneyProvider.value) {
    localError.value = 'Pick a mobile money provider';
    return;
  }
  if (!isMobileMoney.value && !bankName.value.trim()) {
    localError.value = 'Bank name is required for bank transfers';
    return;
  }
  const input: PaymentSettingInput = {
    paymentMethod: paymentMethod.value,
    accountName: accountName.value.trim(),
    accountNumber: accountNumber.value.trim(),
    reference: reference.value.trim() || undefined,
  };
  if (isMobileMoney.value) {
    input.mobileMoneyProvider = mobileMoneyProvider.value;
  } else {
    input.bankName = bankName.value.trim();
  }
  emit('submit', input);
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="onSubmit">
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-2">Payment method *</label>
      <div class="grid grid-cols-2 gap-2">
        <label
          class="cursor-pointer border rounded-lg p-3 text-center text-sm"
          :class="paymentMethod === 'mobile_money' ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-warm-200'"
        >
          <input v-model="paymentMethod" type="radio" value="mobile_money" class="sr-only" />
          Mobile money
        </label>
        <label
          class="cursor-pointer border rounded-lg p-3 text-center text-sm"
          :class="paymentMethod === 'bank' ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-warm-200'"
        >
          <input v-model="paymentMethod" type="radio" value="bank" class="sr-only" />
          Bank transfer
        </label>
      </div>
    </div>

    <div v-if="isMobileMoney">
      <label class="block text-sm font-medium text-slate-700 mb-1">Provider *</label>
      <select
        v-model="mobileMoneyProvider"
        class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
      >
        <option value="mtn">MTN Mobile Money</option>
        <option value="airtel">Airtel Money</option>
        <option value="zamtel">Zamtel Money</option>
      </select>
    </div>

    <div v-else>
      <label class="block text-sm font-medium text-slate-700 mb-1">Bank name *</label>
      <input
        v-model="bankName"
        placeholder="e.g. Zanaco"
        class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Account name *</label>
      <input
        v-model="accountName"
        placeholder="Who should the payment be made to?"
        class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        {{ isMobileMoney ? 'Phone number *' : 'Account number *' }}
      </label>
      <input
        v-model="accountNumber"
        :placeholder="isMobileMoney ? '+260971234567' : '1234567890'"
        class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">Reference (optional)</label>
      <input
        v-model="reference"
        placeholder="e.g. Use your invoice number"
        class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
      />
    </div>

    <p v-if="localError" class="text-sm text-red-600">{{ localError }}</p>

    <div class="flex justify-end gap-2 pt-2">
      <button
        v-if="props.submitting === undefined || props.submitting === false"
        type="button"
        class="px-4 h-10 rounded-lg text-slate-600 hover:bg-slate-50"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="submit"
        :disabled="props.submitting"
        class="px-4 h-10 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        {{ props.submitting ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </form>
</template>
