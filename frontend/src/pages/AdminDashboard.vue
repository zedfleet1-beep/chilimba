<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminStore } from '@/stores/admin';
import { formatNgwe } from '@/lib/money';
import { BarChart3, Users, Receipt, MessageSquare, AlertTriangle, ArrowRight } from 'lucide-vue-next';

const admin = useAdminStore();
const router = useRouter();

onMounted(() => admin.fetchStats());
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div>
      <h2 class="font-display text-2xl font-bold text-slate-900">Admin dashboard</h2>
      <p class="text-sm text-slate-500">Platform health at a glance.</p>
    </div>

    <div v-if="admin.loading" class="text-slate-500">Loading…</div>

    <template v-else-if="admin.stats">
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-5">
          <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <Users class="w-4 h-4" />
            Active groups
          </div>
          <p class="font-display text-3xl font-bold text-slate-900">{{ admin.stats.activeGroups }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-5">
          <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <Users class="w-4 h-4" />
            Total members
          </div>
          <p class="font-display text-3xl font-bold text-slate-900">{{ admin.stats.totalMembers }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-5">
          <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <Receipt class="w-4 h-4" />
            POPs to review
          </div>
          <p class="font-display text-3xl font-bold text-slate-900">{{ admin.stats.pendingPopReviews }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-5">
          <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <BarChart3 class="w-4 h-4" />
            Revenue this month
          </div>
          <p class="font-display text-2xl font-bold text-slate-900">{{ formatNgwe(admin.stats.revenueThisMonthNgwe) }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-5">
          <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <MessageSquare class="w-4 h-4" />
            WhatsApp sent today
          </div>
          <p class="font-display text-3xl font-bold text-slate-900">{{ admin.stats.whatsappSentToday }}</p>
        </div>
        <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-5">
          <div class="flex items-center gap-2 text-coral-600 text-sm mb-2">
            <AlertTriangle class="w-4 h-4" />
            Failed (24h)
          </div>
          <p class="font-display text-3xl font-bold text-coral-700">{{ admin.stats.whatsappFailedRecent }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          class="bg-white rounded-2xl shadow-soft border border-warm-100 p-5 text-left hover:border-warm-200"
          @click="router.push({ name: 'admin-invoices' })"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-slate-800">Review invoices & POPs</span>
            <ArrowRight class="w-4 h-4 text-slate-400" />
          </div>
        </button>
        <button
          class="bg-white rounded-2xl shadow-soft border border-warm-100 p-5 text-left hover:border-warm-200"
          @click="router.push({ name: 'admin-whatsapp-logs' })"
        >
          <div class="flex items-center justify-between">
            <span class="font-medium text-slate-800">WhatsApp delivery logs</span>
            <ArrowRight class="w-4 h-4 text-slate-400" />
          </div>
        </button>
      </div>
    </template>

    <p v-if="admin.error" class="text-sm text-red-600">{{ admin.error }}</p>
  </div>
</template>