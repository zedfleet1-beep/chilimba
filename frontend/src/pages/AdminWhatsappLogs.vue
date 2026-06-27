<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useAdminStore } from '@/stores/admin';
import { getErrorMessage } from '@/api/client';

const admin = useAdminStore();
const statusFilter = ref('');
const sendPhone = ref('');
const sendMessage = ref('');
const sendError = ref('');

onMounted(() => admin.fetchWhatsappLogs());

async function onFilterChange() {
  await admin.fetchWhatsappLogs(statusFilter.value || undefined);
}

async function onSend() {
  sendError.value = '';
  if (!sendPhone.value || !sendMessage.value) {
    sendError.value = 'Phone and message are required';
    return;
  }
  try {
    await admin.sendWhatsapp(sendPhone.value, sendMessage.value);
    sendPhone.value = '';
    sendMessage.value = '';
  } catch (e) {
    sendError.value = getErrorMessage(e);
  }
}

function statusTone(status: string) {
  if (status === 'sent' || status === 'delivered' || status === 'read') {
    return 'bg-emerald-50 text-emerald-700';
  }
  return 'bg-coral-50 text-coral-700';
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="font-display text-2xl font-bold text-slate-900">WhatsApp logs</h2>
      <p class="text-sm text-slate-500">Recent delivery attempts and manual sends.</p>
    </div>

    <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4 space-y-3">
      <h3 class="font-medium text-slate-800">Send a manual message</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          v-model="sendPhone"
          placeholder="+260977123456"
          class="h-10 px-3 rounded-lg border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
        <button
          class="h-10 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 sm:col-span-2 sm:max-w-xs"
          @click="onSend"
        >
          Send
        </button>
      </div>
      <textarea
        v-model="sendMessage"
        rows="3"
        placeholder="Message body…"
        class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
      <p v-if="sendError" class="text-sm text-red-600">{{ sendError }}</p>
    </div>

    <div class="flex items-center gap-2">
      <label class="text-sm text-slate-500">Filter:</label>
      <select
        v-model="statusFilter"
        class="h-10 px-3 rounded-lg border border-slate-200 bg-white"
        @change="onFilterChange"
      >
        <option value="">All</option>
        <option value="sent">Sent</option>
        <option value="failed">Failed</option>
      </select>
    </div>

    <div v-if="admin.loading" class="text-slate-500">Loading…</div>

    <div v-else class="space-y-3">
      <div
        v-for="log in admin.whatsappLogs"
        :key="log.id"
        class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span class="font-mono text-sm text-slate-700">{{ log.toPhone }}</span>
          <div class="flex items-center gap-2 text-xs">
            <span class="px-2 py-0.5 rounded-full font-medium capitalize" :class="statusTone(log.status)">
              {{ log.status }}
            </span>
            <span class="text-slate-500">{{ new Date(log.createdAt).toLocaleString() }}</span>
          </div>
        </div>
        <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ log.message }}</p>
        <p v-if="log.errorMessage" class="text-xs text-coral-600 mt-2">{{ log.errorMessage }}</p>
      </div>
      <p v-if="admin.whatsappLogs.length === 0" class="text-center text-slate-500 py-8">No logs yet.</p>
    </div>

    <p v-if="admin.error" class="text-sm text-red-600">{{ admin.error }}</p>
  </div>
</template>