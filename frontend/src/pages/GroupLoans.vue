<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import * as loansApi from '@/api/loans';
import { formatNgwe, parseNgwe } from '@/lib/money';
import { getErrorMessage } from '@/api/client';
import { HandCoins, Plus, Check, X } from 'lucide-vue-next';
import GroupPicker from '@/components/GroupPicker.vue';

const route = useRoute();
const auth = useAuthStore();
const groups = useGroupsStore();

const loans = ref<loansApi.Loan[]>([]);
const eligibility = ref<loansApi.LoanEligibility | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const showRequest = ref(false);
const requestAmount = ref('');
const requestPurpose = ref('');
const repaymentAmount = ref<Record<string, string>>({});

const groupId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const myRole = computed(() => groups.members.find((m) => m.userId === auth.user?.id)?.role ?? null);
const canManage = computed(() => myRole.value === 'owner' || myRole.value === 'treasurer');

async function load() {
  if (!groupId.value) return;
  loading.value = true;
  error.value = '';
  try {
    await groups.fetchMine();
    await groups.fetchOne(groupId.value);
    [loans.value, eligibility.value] = await Promise.all([
      loansApi.listLoans(groupId.value),
      loansApi.getEligibility(groupId.value),
    ]);
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onRequest() {
  const amountNgwe = parseNgwe(requestAmount.value);
  if (!amountNgwe) {
    error.value = 'Enter a valid amount like 500 or K500.00';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    await loansApi.requestLoan(groupId.value, {
      amountNgwe: amountNgwe.toString(),
      purpose: requestPurpose.value || undefined,
    });
    showRequest.value = false;
    requestAmount.value = '';
    requestPurpose.value = '';
    await load();
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function onApprove(loanId: string) {
  saving.value = true;
  try {
    await loansApi.approveLoan(groupId.value, loanId);
    await load();
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function onReject(loanId: string) {
  const reason = prompt('Reason for rejection (optional)') ?? undefined;
  saving.value = true;
  try {
    await loansApi.rejectLoan(groupId.value, loanId, reason);
    await load();
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

async function onRepay(loanId: string) {
  const amountNgwe = parseNgwe(repaymentAmount.value[loanId] ?? '');
  if (!amountNgwe) {
    error.value = 'Enter a valid repayment amount';
    return;
  }
  saving.value = true;
  try {
    await loansApi.recordRepayment(groupId.value, loanId, { amountNgwe: amountNgwe.toString() });
    repaymentAmount.value[loanId] = '';
    await load();
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
watch(() => route.params.id, load);
</script>

<template>
  <div class="max-w-4xl space-y-6 min-w-0">
    <GroupPicker />

    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <h2 class="font-display text-2xl font-bold text-slate-900">Loans</h2>
        <p class="text-sm text-slate-500">Request, approve, and track repayments.</p>
      </div>
      <button
        v-if="eligibility?.allowLoans && !eligibility.hasActiveLoan"
        class="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        @click="showRequest = true"
      >
        <Plus class="w-4 h-4" />
        Request loan
      </button>
    </div>

    <div v-if="eligibility" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
      <div>
        <p class="text-slate-500">Loans enabled</p>
        <p class="font-medium">{{ eligibility.allowLoans ? 'Yes' : 'No' }}</p>
      </div>
      <div>
        <p class="text-slate-500">Your savings</p>
        <p class="font-medium">{{ formatNgwe(eligibility.savingsNgwe) }}</p>
      </div>
      <div>
        <p class="text-slate-500">Max loan</p>
        <p class="font-medium">{{ formatNgwe(eligibility.maxLoanNgwe) }}</p>
      </div>
      <div>
        <p class="text-slate-500">Interest</p>
        <p class="font-medium">{{ (eligibility.interestRate * 100).toFixed(0) }}%</p>
      </div>
    </div>

    <div v-if="loading" class="text-slate-500">Loading…</div>

    <div v-else class="space-y-3">
      <div
        v-for="loan in loans"
        :key="loan.id"
        class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4 space-y-3"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-medium text-slate-800">
              {{ loan.member.user.firstName }} {{ loan.member.user.lastName }}
            </p>
            <p class="text-sm text-slate-600">
              {{ formatNgwe(loan.amountNgwe) }} + interest → {{ formatNgwe(loan.totalDueNgwe) }} total
            </p>
            <p v-if="loan.purpose" class="text-xs text-slate-500 mt-1">{{ loan.purpose }}</p>
          </div>
          <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-warm-50 text-slate-700 capitalize">{{ loan.status }}</span>
        </div>

        <p class="text-sm text-slate-600">
          Repaid {{ formatNgwe(loan.amountRepaidNgwe) }} of {{ formatNgwe(loan.totalDueNgwe) }}
        </p>

        <div v-if="canManage && loan.status === 'pending'" class="flex gap-2">
          <button
            class="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700"
            :disabled="saving"
            @click="onApprove(loan.id)"
          >
            <Check class="w-4 h-4" /> Approve
          </button>
          <button
            class="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-warm-50"
            :disabled="saving"
            @click="onReject(loan.id)"
          >
            <X class="w-4 h-4" /> Reject
          </button>
        </div>

        <div v-if="canManage && loan.status === 'active'" class="flex gap-2">
          <input
            v-model="repaymentAmount[loan.id]"
            placeholder="Repayment amount"
            class="h-9 px-3 rounded-lg border border-slate-200 text-sm flex-1"
          />
          <button
            class="h-9 px-3 rounded-lg bg-brand-600 text-white text-sm hover:bg-brand-700"
            :disabled="saving"
            @click="onRepay(loan.id)"
          >
            Record
          </button>
        </div>

        <div v-if="loan.repayments.length" class="text-xs text-slate-500 space-y-1 pt-2 border-t border-warm-50">
          <p v-for="r in loan.repayments" :key="r.id">
            {{ formatNgwe(r.amountNgwe) }} on {{ new Date(r.paidAt).toLocaleDateString() }}
          </p>
        </div>
      </div>

      <div v-if="loans.length === 0" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-10 text-center">
        <HandCoins class="w-10 h-10 mx-auto text-warm-500 mb-3" />
        <p class="text-slate-600">No loans yet.</p>
      </div>
    </div>

    <div v-if="showRequest" class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40">
      <div class="bg-white rounded-2xl shadow-xl border border-warm-100 w-full max-w-md p-6 space-y-3">
        <h3 class="font-display text-lg font-semibold">Request a loan</h3>
        <input
          v-model="requestAmount"
          placeholder="Amount e.g. 500"
          class="w-full h-10 px-3 rounded-lg border border-slate-200"
        />
        <textarea
          v-model="requestPurpose"
          rows="3"
          placeholder="Purpose (optional)"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <div class="flex justify-end gap-2">
          <button class="px-4 h-10 rounded-lg text-slate-600 hover:bg-slate-50" @click="showRequest = false">Cancel</button>
          <button class="px-4 h-10 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700" :disabled="saving" @click="onRequest">
            Submit
          </button>
        </div>
      </div>
    </div>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
  </div>
</template>