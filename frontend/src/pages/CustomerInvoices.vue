<script setup lang="ts">
import { onMounted } from 'vue';
import { useInvoicesStore } from '@/stores/invoices';
import { formatNgwe } from '@/lib/money';
import { ArrowRight, Receipt } from 'lucide-vue-next';

const store = useInvoicesStore();

onMounted(() => store.fetchMine());
</script>

<template>
  <div class="space-y-6 max-w-3xl">
    <div>
      <h2 class="font-display text-2xl font-bold text-slate-900">My invoices</h2>
      <p class="text-sm text-slate-500">Your Chilimba invoices. Pay a pending one to start your group.</p>
    </div>

    <p v-if="store.error" class="text-sm text-red-600">{{ store.error }}</p>

    <div v-if="store.loading" class="text-slate-500">Loading…</div>

    <div v-else-if="store.invoices.length === 0" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-10 text-center">
      <Receipt class="w-10 h-10 mx-auto text-warm-500 mb-3" />
      <p class="font-medium text-slate-700">No invoices yet</p>
      <p class="text-sm text-slate-500 mt-1">When you purchase a Chilimba plan, your invoices will appear here.</p>
    </div>

    <div v-else class="space-y-3">
      <router-link
        v-for="inv in store.invoices"
        :key="inv.id"
        :to="{ name: 'customer-invoice-detail', params: { id: inv.id } }"
        class="flex items-center justify-between bg-white rounded-2xl shadow-soft border border-warm-100 p-5 hover:border-warm-200 transition-colors"
      >
        <div>
          <p class="font-mono text-xs text-slate-500">{{ inv.invoiceNumber }}</p>
          <p class="font-display text-lg font-semibold text-slate-900">{{ formatNgwe(inv.amountNgwe) }}</p>
          <p class="text-sm text-slate-500 mt-1">{{ inv.description ?? '—' }}</p>
        </div>
        <div class="flex items-center gap-3">
          <span
            v-if="inv.status === 'pending' && inv.paymentProofs?.[0]?.status === 'pending'"
            class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700"
          >
            POP submitted
          </span>
          <span
            class="px-2.5 py-0.5 rounded-full text-xs font-medium"
            :class="{
              'bg-warm-100 text-warm-600': inv.status === 'pending',
              'bg-brand-50 text-brand-700': inv.status === 'paid',
              'bg-slate-100 text-slate-500': inv.status === 'cancelled',
            }"
          >
            {{ inv.status }}
          </span>
          <ArrowRight v-if="inv.status === 'pending'" class="w-4 h-4 text-brand-600" />
        </div>
      </router-link>
    </div>
  </div>
</template>
