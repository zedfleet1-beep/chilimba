<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useAdminInvoicesStore } from '@/stores/adminInvoices';
import { formatNgwe } from '@/lib/money';
import { Plus, Search } from 'lucide-vue-next';
import AdminInvoiceCreateModal from '@/components/AdminInvoiceCreateModal.vue';

const store = useAdminInvoicesStore();
const showCreate = ref(false);
const search = ref('');

const visible = computed(() => {
  if (!search.value) return store.filtered;
  const q = search.value.toLowerCase();
  return store.filtered.filter(
    (i) => i.invoiceNumber.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q) || i.phone.includes(q),
  );
});

onMounted(() => store.fetchAll());

async function onCreated() {
  showCreate.value = false;
  await store.fetchAll();
}
</script>

<template>
  <div class="space-y-6 min-w-0">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 class="font-display text-2xl font-bold text-slate-900">All invoices</h2>
        <p class="text-sm text-slate-500">Create invoices, review POPs, and watch the payment queue.</p>
      </div>
      <button
        class="inline-flex items-center gap-2 px-4 h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-sm"
        @click="showCreate = true"
      >
        <Plus class="w-4 h-4" />
        New invoice
      </button>
    </div>

    <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
      <div class="relative flex-1">
        <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="search"
          placeholder="Search by name, number, or phone…"
          class="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        />
      </div>
      <div class="flex items-center gap-2 text-sm">
        <label class="text-slate-500">Status:</label>
        <select
          v-model="store.filter.status"
          class="h-10 px-3 rounded-lg border border-slate-200 bg-white"
          @change="store.fetchAll()"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>

    <p v-if="store.error" class="text-sm text-red-600">{{ store.error }}</p>

    <div class="bg-white rounded-2xl shadow-soft border border-warm-100 table-scroll">
      <table class="w-full text-sm">
        <thead class="bg-warm-50 text-slate-500 text-left">
          <tr>
            <th class="px-4 py-3 font-medium">Number</th>
            <th class="px-4 py-3 font-medium">Customer</th>
            <th class="px-4 py-3 font-medium">Phone</th>
            <th class="px-4 py-3 font-medium text-right">Amount</th>
            <th class="px-4 py-3 font-medium">Status</th>
            <th class="px-4 py-3 font-medium">Created</th>
            <th class="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.loading">
            <td colspan="7" class="px-4 py-8 text-center text-slate-500">Loading…</td>
          </tr>
          <tr
            v-for="inv in visible"
            :key="inv.id"
            class="border-t border-warm-50 hover:bg-warm-50/40 cursor-pointer"
            @click="$router.push({ name: 'admin-invoice-detail', params: { id: inv.id } })"
          >
            <td class="px-4 py-3 font-mono text-slate-700">{{ inv.invoiceNumber }}</td>
            <td class="px-4 py-3 text-slate-800">{{ inv.customerName }}</td>
            <td class="px-4 py-3 text-slate-600 font-mono text-xs">{{ inv.phone }}</td>
            <td class="px-4 py-3 text-right font-medium text-slate-800">{{ formatNgwe(inv.amountNgwe) }}</td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="{
                  'bg-warm-100 text-warm-600': inv.status === 'pending',
                  'bg-brand-50 text-brand-700': inv.status === 'paid',
                  'bg-slate-100 text-slate-500': inv.status === 'cancelled',
                }"
              >
                {{ inv.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-500">{{ new Date(inv.createdAt).toLocaleDateString() }}</td>
            <td class="px-4 py-3 text-right text-brand-600">View →</td>
          </tr>
          <tr v-if="!store.loading && visible.length === 0">
            <td colspan="7" class="px-4 py-12 text-center text-slate-500">
              <p class="mb-1 font-medium text-slate-700">No invoices yet 🌱</p>
              <p class="text-sm">Create one to get started.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdminInvoiceCreateModal v-if="showCreate" @close="showCreate = false" @created="onCreated" />
  </div>
</template>
