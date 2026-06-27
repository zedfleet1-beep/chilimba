<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAdminInvoicesStore } from '@/stores/adminInvoices';
import { usePaymentSettingsStore } from '@/stores/paymentSettings';
import { getErrorMessage } from '@/api/client';
import { X, Check, ChevronDown, ChevronUp } from 'lucide-vue-next';
import PhoneInput from '@/components/PhoneInput.vue';
import PaymentSettingsForm from '@/components/PaymentSettingsForm.vue';
import type { PaymentSettingInput } from '@/api/paymentSettings';

const emit = defineEmits<{ close: []; created: [] }>();
const store = useAdminInvoicesStore();
const payments = usePaymentSettingsStore();

const customerName = ref('');
const phone = ref('');
const email = ref('');
const amountK = ref(''); // user-facing Kwacha
const description = ref('');

const useDefault = ref(true);
const showOverride = ref(false);
const overrideInput = ref<PaymentSettingInput | null>(null);

const submitting = ref(false);
const localError = ref('');

onMounted(() => {
  if (!payments.platform) payments.fetchPlatform();
});

async function onSubmit() {
  localError.value = '';
  if (!customerName.value || !phone.value || !amountK.value) {
    localError.value = 'Name, phone, and amount are required';
    return;
  }
  const kwacha = Number(amountK.value);
  if (!Number.isFinite(kwacha) || kwacha <= 0) {
    localError.value = 'Enter a valid positive amount in Kwacha';
    return;
  }
  if (!useDefault.value && !overrideInput.value) {
    localError.value = 'Fill in the override payment details or switch back to the platform default';
    return;
  }
  submitting.value = true;
  try {
    // Create the invoice first.
    const created = await store.createInvoice({
      customerName: customerName.value,
      phone: phone.value,
      email: email.value || undefined,
      amountNgwe: Math.round(kwacha * 100),
      description: description.value || undefined,
    });
    // If an override was supplied, upsert it.
    if (!useDefault.value && overrideInput.value) {
      const { upsertInvoiceOverride } = await import('@/api/paymentSettings');
      await upsertInvoiceOverride(created.id, overrideInput.value);
    }
    emit('created');
  } catch (e) {
    localError.value = getErrorMessage(e);
  } finally {
    submitting.value = false;
  }
}

function onOverrideSubmit(input: PaymentSettingInput) {
  overrideInput.value = input;
  showOverride.value = false;
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 overflow-y-auto">
    <div class="bg-white rounded-2xl shadow-xl border border-warm-100 w-full max-w-md p-6 my-8">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-display text-lg font-semibold text-slate-900">New invoice</h3>
        <button class="text-slate-500 hover:text-slate-700" @click="emit('close')" aria-label="Close">
          <X class="w-5 h-5" />
        </button>
      </div>
      <form class="space-y-3" @submit.prevent="onSubmit">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Customer name *</label>
          <input
            v-model="customerName"
            required
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
        <PhoneInput v-model="phone" label="Phone *" required />
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Amount (Kwacha) *</label>
          <input
            v-model="amountK"
            type="number"
            min="0"
            step="0.01"
            required
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            v-model="description"
            rows="2"
            class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>

        <!-- Payment details -->
        <div class="border-t border-warm-50 pt-3">
          <label class="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              v-model="useDefault"
              type="checkbox"
              class="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Use platform default payment details
          </label>
          <p
            v-if="useDefault && payments.platform"
            class="text-xs text-slate-500 mt-1 ml-6"
          >
            {{ payments.platform.accountName }} · {{ payments.platform.accountNumber }}
          </p>
          <p
            v-else-if="useDefault && !payments.platform"
            class="text-xs text-amber-700 mt-1 ml-6"
          >
            No platform default set yet. <router-link to="/admin/payment-settings" class="underline">Set one up</router-link> or use an override.
          </p>

          <div v-if="!useDefault" class="mt-3">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
              @click="showOverride = !showOverride"
            >
              <component :is="showOverride ? ChevronUp : ChevronDown" class="w-4 h-4" />
              {{ showOverride ? 'Hide override form' : overrideInput ? 'Edit override' : 'Add override' }}
            </button>
            <p v-if="overrideInput && !showOverride" class="text-xs text-slate-500 mt-1">
              {{ overrideInput.accountName }} · {{ overrideInput.accountNumber }}
            </p>
            <div v-if="showOverride" class="mt-3 p-3 rounded-lg bg-warm-50/40 border border-warm-100">
              <PaymentSettingsForm
                :initial="overrideInput ?? undefined"
                :submitting="false"
                @submit="onOverrideSubmit"
                @cancel="showOverride = false"
              />
            </div>
          </div>
        </div>

        <p v-if="localError" class="text-sm text-red-600">{{ localError }}</p>
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-4 h-10 rounded-lg text-slate-600 hover:bg-slate-50"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            <Check class="w-4 h-4" />
            {{ submitting ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
