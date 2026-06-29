<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useInvoicesStore } from '@/stores/invoices';
import { formatNgwe } from '@/lib/money';
import { Sparkles, ArrowRight, Receipt, Users, RotateCw, BarChart3 } from 'lucide-vue-next';
import { useRouter } from 'vue-router';

const auth = useAuthStore();
const groups = useGroupsStore();
const invoices = useInvoicesStore();
const router = useRouter();
const isSuperAdmin = computed(() => auth.user?.role === 'super_admin');

onMounted(async () => {
  const tasks = [groups.fetchMine()];
  if (isSuperAdmin.value) tasks.push(invoices.fetchMine());
  await Promise.all(tasks);
});
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div class="bg-gradient-to-br from-warm-50 to-cream-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-soft border border-warm-100 dark:border-slate-700 p-8">
      <div class="flex items-center gap-2 text-warm-600 dark:text-amber-300 mb-2">
        <Sparkles class="w-5 h-5" />
        <span class="text-sm font-medium">Welcome back</span>
      </div>
      <h1 class="font-display text-3xl font-bold text-slate-900">
        Hello, {{ auth.user?.firstName }}! 👋
      </h1>
      <p class="text-slate-600 mt-1">
        Here's a quick look at your Chilimba activity.
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        v-if="isSuperAdmin"
        class="bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-warm-100 dark:border-slate-700 p-6 text-left hover:border-warm-200 dark:hover:border-slate-600 transition-colors"
        @click="router.push({ name: 'customer-invoices' })"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-lg bg-warm-50 text-warm-600 flex items-center justify-center">
            <Receipt class="w-5 h-5" />
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400" />
        </div>
        <p class="font-display text-lg font-semibold text-slate-900">My invoices</p>
        <p class="text-sm text-slate-500 mt-1">
          {{ invoices.pending.length }} pending · {{ invoices.paid.length }} paid
        </p>
        <p v-if="invoices.pending[0]" class="mt-3 text-sm text-slate-700">
          Next: pay <span class="font-mono">{{ invoices.pending[0].invoiceNumber }}</span> for
          <span class="font-medium">{{ formatNgwe(invoices.pending[0].amountNgwe) }}</span>
        </p>
      </button>

      <button
        class="bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-warm-100 dark:border-slate-700 p-6 text-left hover:border-warm-200 dark:hover:border-slate-600 transition-colors"
        @click="groups.groups[0] ? router.push({ name: 'group-detail', params: { id: groups.groups[0].id } }) : router.push({ name: 'group-list' })"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Users class="w-5 h-5" />
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400" />
        </div>
        <p class="font-display text-lg font-semibold text-slate-900">My group</p>
        <p v-if="groups.groups[0]" class="text-sm text-slate-500 mt-1">
          {{ groups.groups[0].name }} · {{ groups.groups[0].memberCount }} members
        </p>
        <p v-else class="text-sm text-slate-500 mt-1">
          No group yet. Pay an invoice to get started.
        </p>
      </button>

      <button
        v-if="groups.groups[0]"
        class="bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-warm-100 dark:border-slate-700 p-6 text-left hover:border-warm-200 dark:hover:border-slate-600 transition-colors"
        @click="router.push({ name: 'group-cycles', params: { id: groups.groups[0].id } })"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
            <RotateCw class="w-5 h-5" />
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400" />
        </div>
        <p class="font-display text-lg font-semibold text-slate-900">Cycles</p>
        <p class="text-sm text-slate-500 mt-1">
          Manage contributions, rounds, and payouts
        </p>
      </button>

      <button
        v-if="groups.groups[0]"
        class="bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-warm-100 dark:border-slate-700 p-6 text-left hover:border-warm-200 dark:hover:border-slate-600 transition-colors"
        @click="router.push({ name: 'group-reports', params: { id: groups.groups[0].id } })"
      >
        <div class="flex items-center justify-between mb-3">
          <div class="w-10 h-10 rounded-lg bg-warm-50 text-warm-600 flex items-center justify-center">
            <BarChart3 class="w-5 h-5" />
          </div>
          <ArrowRight class="w-4 h-4 text-slate-400" />
        </div>
        <p class="font-display text-lg font-semibold text-slate-900">Reports</p>
        <p class="text-sm text-slate-500 mt-1">
          Cycle summary, outstanding, and loan book
        </p>
      </button>
    </div>
  </div>
</template>
