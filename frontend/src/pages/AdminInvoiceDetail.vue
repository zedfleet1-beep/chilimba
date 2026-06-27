<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAdminInvoicesStore } from '@/stores/adminInvoices';
import { refreshPopDownloadUrl } from '@/api/invoices';
import { formatNgwe } from '@/lib/money';
import { getErrorMessage } from '@/api/client';
import { Check, X, Copy, ArrowLeft, FileText, ExternalLink } from 'lucide-vue-next';
import PaymentDetailsCard from '@/components/PaymentDetailsCard.vue';
import type { PaymentProof } from '@/api/invoices';

const route = useRoute();
const router = useRouter();
const store = useAdminInvoicesStore();
const id = computed(() => String(route.params.id));

const showReject = ref(false);
const rejectReason = ref('');
const approving = ref<string | null>(null);
const lastApproval = ref<{ token: string; link: string } | null>(null);
const downloadUrl = ref<string | null>(null);
const localError = ref('');

onMounted(() => store.fetchOne(id.value));

const invoice = computed(() => store.current);

async function approve(popId: string) {
  localError.value = '';
  approving.value = popId;
  try {
    const result = await store.approve(popId);
    if (result) {
      lastApproval.value = {
        token: result.groupCreationToken,
        link: result.groupCreationLink,
      };
    }
  } catch (e) {
    localError.value = getErrorMessage(e);
  } finally {
    approving.value = null;
  }
}

async function reject(popId: string) {
  if (!rejectReason.value.trim()) {
    localError.value = 'Please enter a rejection reason';
    return;
  }
  localError.value = '';
  try {
    await store.reject(popId, rejectReason.value);
    showReject.value = false;
    rejectReason.value = '';
  } catch (e) {
    localError.value = getErrorMessage(e);
  }
}

async function viewPop(pop: PaymentProof) {
  try {
    const { url } = await refreshPopDownloadUrl(pop.id);
    downloadUrl.value = url;
    window.open(url, '_blank');
  } catch (e) {
    localError.value = getErrorMessage(e);
  }
}

async function copyToken() {
  if (!lastApproval.value) return;
  try {
    await navigator.clipboard.writeText(lastApproval.value.token);
  } catch {
    /* clipboard may not be available in all browsers */
  }
}

function fileIconFor(fileType: string) {
  return fileType === 'pdf' ? FileText : FileText;
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <button
      class="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      @click="router.push({ name: 'admin-invoices' })"
    >
      <ArrowLeft class="w-4 h-4" />
      All invoices
    </button>

    <div v-if="!invoice && store.loading" class="text-slate-500">Loading…</div>

    <div v-else-if="invoice" class="space-y-6">
      <!-- Header card -->
      <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p class="font-mono text-sm text-slate-500">{{ invoice.invoiceNumber }}</p>
            <h2 class="font-display text-2xl font-bold text-slate-900">{{ invoice.customerName }}</h2>
            <p class="text-sm text-slate-500 font-mono mt-1">{{ invoice.phone }}<span v-if="invoice.email"> · {{ invoice.email }}</span></p>
          </div>
          <div class="text-right">
            <p class="font-display text-3xl font-bold text-slate-900">{{ formatNgwe(invoice.amountNgwe) }}</p>
            <span
              class="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="{
                'bg-warm-100 text-warm-600': invoice.status === 'pending',
                'bg-brand-50 text-brand-700': invoice.status === 'paid',
                'bg-slate-100 text-slate-500': invoice.status === 'cancelled',
              }"
            >
              {{ invoice.status }}
            </span>
            <p v-if="invoice.paidAt" class="text-xs text-slate-500 mt-2">Paid {{ new Date(invoice.paidAt).toLocaleString() }}</p>
          </div>
        </div>
        <p v-if="invoice.description" class="mt-4 text-sm text-slate-600 border-t border-warm-50 pt-3">
          {{ invoice.description }}
        </p>
      </div>

      <!-- Customer-facing payment details preview -->
      <PaymentDetailsCard
        v-if="invoice.status === 'pending'"
        :details="invoice.paymentDetails ?? null"
        heading="Customer will see"
        :show-source="true"
      />

      <!-- POPs -->
      <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6">
        <h3 class="font-display text-lg font-semibold text-slate-900 mb-4">Proofs of payment</h3>
        <p v-if="!invoice.paymentProofs?.length" class="text-sm text-slate-500">
          No POPs uploaded yet.
        </p>
        <ul v-else class="divide-y divide-warm-50">
          <li v-for="pop in invoice.paymentProofs" :key="pop.id" class="py-3 flex items-center gap-3">
            <component :is="fileIconFor(pop.fileType)" class="w-5 h-5 text-slate-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-mono text-slate-700 truncate">{{ pop.fileKey }}</p>
              <p class="text-xs text-slate-500">
                {{ pop.fileType.toUpperCase() }} · uploaded {{ new Date(pop.createdAt).toLocaleString() }}
                <span v-if="pop.notes"> · {{ pop.notes }}</span>
              </p>
            </div>
            <span
              class="px-2 py-0.5 rounded-full text-xs font-medium"
              :class="{
                'bg-warm-100 text-warm-600': pop.status === 'pending',
                'bg-brand-50 text-brand-700': pop.status === 'approved',
                'bg-coral-500/10 text-coral-600': pop.status === 'rejected',
              }"
            >
              {{ pop.status }}
            </span>
            <button
              class="text-slate-500 hover:text-brand-600 p-1"
              title="View"
              @click="viewPop(pop)"
            >
              <ExternalLink class="w-4 h-4" />
            </button>
            <template v-if="pop.status === 'pending'">
              <button
                :disabled="approving === pop.id"
                class="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
                @click="approve(pop.id)"
              >
                <Check class="w-3 h-3" />
                {{ approving === pop.id ? 'Approving…' : 'Approve' }}
              </button>
              <button
                class="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-white border border-coral-500 text-coral-600 text-xs font-medium hover:bg-coral-500/5"
                @click="showReject = true"
              >
                <X class="w-3 h-3" />
                Reject
              </button>
            </template>
          </li>
        </ul>
      </div>

      <!-- Approval result (token for QA) -->
      <div v-if="lastApproval" class="bg-brand-50 border border-brand-100 rounded-2xl p-6">
        <h3 class="font-display text-lg font-semibold text-brand-700 mb-2">🎉 Payment approved</h3>
        <p class="text-sm text-brand-800/80 mb-3">
          The customer was sent a WhatsApp with this link. You can also copy the token below for QA.
        </p>
        <div class="bg-white border border-brand-100 rounded-lg p-3 flex items-center gap-2">
          <code class="text-xs text-slate-700 flex-1 break-all">{{ lastApproval.token }}</code>
          <button
            class="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-700 hover:bg-brand-50 rounded"
            @click="copyToken"
          >
            <Copy class="w-3 h-3" />
            Copy
          </button>
          <a
            :href="lastApproval.link"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-700 hover:bg-brand-50 rounded"
          >
            <ExternalLink class="w-3 h-3" />
            Open
          </a>
        </div>
      </div>

      <p v-if="localError" class="text-sm text-red-600">{{ localError }}</p>
    </div>

    <!-- Reject modal -->
    <div v-if="showReject" class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40">
      <div class="bg-white rounded-2xl shadow-xl border border-warm-100 w-full max-w-md p-6">
        <h3 class="font-display text-lg font-semibold text-slate-900 mb-3">Reject POP</h3>
        <p class="text-sm text-slate-600 mb-3">Tell the customer what went wrong. They'll see this in WhatsApp.</p>
        <textarea
          v-model="rejectReason"
          rows="3"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          placeholder="e.g. Image is too blurry to read"
        />
        <div class="flex justify-end gap-2 mt-4">
          <button class="px-4 h-10 rounded-lg text-slate-600 hover:bg-slate-50" @click="showReject = false">Cancel</button>
          <button
            class="px-4 h-10 rounded-lg bg-coral-600 text-white font-medium hover:bg-coral-500"
            @click="reject(invoice!.paymentProofs![0].id)"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
