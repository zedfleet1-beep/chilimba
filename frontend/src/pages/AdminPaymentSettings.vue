<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { usePaymentSettingsStore } from '@/stores/paymentSettings';
import { CreditCard, Edit3 } from 'lucide-vue-next';
import { displayFor } from '@/lib/payment';
import { computed } from 'vue';
import AdminPaymentSettingsModal from '@/components/AdminPaymentSettingsModal.vue';

const store = usePaymentSettingsStore();
const showEdit = ref(false);

onMounted(() => store.fetchPlatform());

const display = computed(() => (store.platform ? displayFor(store.platform) : null));
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <div>
      <h2 class="font-display text-2xl font-bold text-slate-900">Payment settings</h2>
      <p class="text-sm text-slate-500">
        The default mobile-money or bank account that all invoices fall back to. Invoices can
        override this on a per-customer basis.
      </p>
    </div>

    <p v-if="store.error" class="text-sm text-red-600">{{ store.error }}</p>

    <div v-if="store.loading" class="text-slate-500">Loading…</div>

    <div
      v-else-if="store.platform && display"
      class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2 text-warm-600">
          <CreditCard class="w-5 h-5" />
          <span class="font-display text-lg font-semibold text-slate-900">Current default</span>
        </div>
        <button
          class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-warm-50"
          @click="showEdit = true"
        >
          <Edit3 class="w-4 h-4" />
          Edit
        </button>
      </div>

      <div class="mt-4 space-y-3">
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          :class="display.badgeClass"
        >
          <component :is="display.icon" class="w-3.5 h-3.5" />
          {{ display.badgeText }}
        </span>
        <div>
          <p class="text-sm text-slate-500">{{ display.accountLine }}</p>
          <p class="font-mono text-2xl font-semibold text-slate-900 break-all">
            {{ store.platform.accountNumber }}
          </p>
          <p v-if="store.platform.reference" class="text-sm text-slate-600 mt-2">
            <span class="font-medium">Reference:</span> {{ store.platform.reference }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-else
      class="bg-white rounded-2xl shadow-soft border border-warm-100 p-8 text-center"
    >
      <CreditCard class="w-10 h-10 mx-auto text-warm-500 mb-3" />
      <p class="font-medium text-slate-700">No platform default set</p>
      <p class="text-sm text-slate-500 mt-1 mb-4">
        Set your default payment account so new invoices can show customers where to pay.
      </p>
      <button
        class="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700"
        @click="showEdit = true"
      >
        Set up now
      </button>
    </div>

    <AdminPaymentSettingsModal
      v-if="showEdit"
      :initial="store.platform ?? undefined"
      @close="showEdit = false"
      @saved="showEdit = false"
    />
  </div>
</template>
