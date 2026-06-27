<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useGroupsStore } from '@/stores/groups';
import * as reportsApi from '@/api/reports';
import { formatNgwe } from '@/lib/money';
import { getErrorMessage } from '@/api/client';
import { BarChart3, Users, AlertCircle, BookOpen, Table2, Download } from 'lucide-vue-next';
import { formatRoundLabel } from '@/lib/roundLabels';

const route = useRoute();
const groups = useGroupsStore();

const tab = ref<'summary' | 'outstanding' | 'members' | 'loans' | 'ledger'>('summary');
const loading = ref(false);
const error = ref('');
const summary = ref<reportsApi.CycleSummary | null>(null);
const outstanding = ref<reportsApi.OutstandingReport | null>(null);
const loanBook = ref<reportsApi.LoanBook | null>(null);
const selectedMemberId = ref('');
const memberStatement = ref<reportsApi.MemberStatement | null>(null);
const payoutLedger = ref<reportsApi.PayoutLedger | null>(null);
const pdfLoading = ref(false);

const groupId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));

async function loadAll() {
  if (!groupId.value) return;
  loading.value = true;
  error.value = '';
  try {
    await groups.fetchOne(groupId.value);
    [summary.value, outstanding.value, loanBook.value, payoutLedger.value] = await Promise.all([
      reportsApi.getCycleSummary(groupId.value),
      reportsApi.getOutstanding(groupId.value),
      reportsApi.getLoanBook(groupId.value),
      reportsApi.getPayoutLedger(groupId.value),
    ]);
    if (!selectedMemberId.value && groups.members[0]) {
      selectedMemberId.value = groups.members[0].id;
    }
    if (selectedMemberId.value) {
      memberStatement.value = await reportsApi.getMemberStatement(groupId.value, selectedMemberId.value);
    }
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function loadMemberStatement() {
  if (!groupId.value || !selectedMemberId.value) return;
  try {
    memberStatement.value = await reportsApi.getMemberStatement(groupId.value, selectedMemberId.value);
  } catch (e) {
    error.value = getErrorMessage(e);
  }
}

const frequency = computed(() => groups.current?.settings?.contributionFrequency ?? 'monthly');

function roundLabel(roundNumber: number, dueDate: string) {
  return formatRoundLabel(roundNumber, dueDate, frequency.value);
}

async function onDownloadPdf() {
  if (!groupId.value) return;
  pdfLoading.value = true;
  error.value = '';
  try {
    await reportsApi.downloadPayoutLedgerPdf(groupId.value, payoutLedger.value?.cycle?.id);
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    pdfLoading.value = false;
  }
}

onMounted(loadAll);
watch(() => route.params.id, loadAll);
watch(selectedMemberId, loadMemberStatement);
</script>

<template>
  <div class="max-w-6xl space-y-6">
    <div>
      <h2 class="font-display text-2xl font-bold text-slate-900">Reports</h2>
      <p class="text-sm text-slate-500">{{ groups.current?.name ?? 'Group' }} — cycle summaries, outstanding, and loans.</p>
    </div>

    <div class="flex gap-1 border-b border-warm-100 overflow-x-auto">
      <button
        v-for="t in [
          { id: 'summary', label: 'Cycle summary', icon: BarChart3 },
          { id: 'outstanding', label: 'Outstanding', icon: AlertCircle },
          { id: 'members', label: 'Member statements', icon: Users },
          { id: 'loans', label: 'Loan book', icon: BookOpen },
          { id: 'ledger', label: 'Payout ledger', icon: Table2 },
        ] as const"
        :key="t.id"
        class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap"
        :class="tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
        @click="tab = t.id"
      >
        <component :is="t.icon" class="w-4 h-4" />
        {{ t.label }}
      </button>
    </div>

    <div v-if="loading" class="text-slate-500">Loading…</div>

    <template v-else>
      <div v-if="tab === 'summary' && summary" class="space-y-4">
        <div v-if="summary.cycle" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Cycle</p>
            <p class="font-display text-xl font-bold">#{{ summary.cycle.cycleNumber }}</p>
          </div>
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Collected</p>
            <p class="font-display text-xl font-bold">{{ formatNgwe(summary.totalCollectedNgwe) }}</p>
          </div>
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Paid out</p>
            <p class="font-display text-xl font-bold">{{ formatNgwe(summary.totalPaidOutNgwe) }}</p>
          </div>
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Balance</p>
            <p class="font-display text-xl font-bold">{{ formatNgwe(summary.balanceNgwe) }}</p>
          </div>
        </div>
        <p v-else class="text-slate-500">No cycles yet. Open one from the Cycles page.</p>

        <div v-if="summary.rounds.length" class="bg-white rounded-2xl shadow-soft border border-warm-100 divide-y divide-warm-50">
          <div v-for="round in summary.rounds" :key="round.id" class="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-medium text-slate-800">{{ roundLabel(round.roundNumber, round.dueDate) }}</p>
              <p class="text-xs text-slate-500">Due {{ new Date(round.dueDate).toLocaleDateString() }} · {{ round.status }}</p>
            </div>
            <div class="text-sm text-slate-600">
              Collected {{ formatNgwe(round.collectedNgwe) }} · Paid out {{ formatNgwe(round.paidOutNgwe) }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="tab === 'outstanding' && outstanding" class="bg-white rounded-2xl shadow-soft border border-warm-100">
        <div class="p-4 border-b border-warm-50">
          <p v-if="outstanding.round" class="text-sm text-slate-600">
            {{ roundLabel(outstanding.round.roundNumber, outstanding.round.dueDate) }} due {{ new Date(outstanding.round.dueDate).toLocaleDateString() }}
            · {{ formatNgwe(outstanding.round.totalCollectedNgwe) }} collected
          </p>
          <p v-else class="text-slate-500">No active round.</p>
        </div>
        <ul v-if="outstanding.members.length" class="divide-y divide-warm-50">
          <li v-for="m in outstanding.members" :key="m.memberId" class="px-4 py-3 flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-800">{{ m.firstName }} {{ m.lastName }}</p>
              <p class="text-xs font-mono text-slate-500">{{ m.phone }}</p>
            </div>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-coral-50 text-coral-700 capitalize">{{ m.status }}</span>
          </li>
        </ul>
        <p v-else class="p-8 text-center text-emerald-600 text-sm">Everyone is up to date for this round.</p>
      </div>

      <div v-if="tab === 'members'" class="space-y-4">
        <select
          v-model="selectedMemberId"
          class="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
        >
          <option v-for="m in groups.members" :key="m.id" :value="m.id">
            {{ m.user?.firstName }} {{ m.user?.lastName }}
          </option>
        </select>

        <div v-if="memberStatement" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Contributed</p>
            <p class="font-display text-xl font-bold">{{ formatNgwe(memberStatement.totalContributedNgwe) }}</p>
          </div>
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Received</p>
            <p class="font-display text-xl font-bold">{{ formatNgwe(memberStatement.totalReceivedNgwe) }}</p>
          </div>
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Net position</p>
            <p class="font-display text-xl font-bold">{{ formatNgwe(memberStatement.netPositionNgwe) }}</p>
          </div>
        </div>

        <div v-if="memberStatement" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4 space-y-3">
          <h3 class="font-medium text-slate-800">Contributions</h3>
          <div v-for="c in memberStatement.contributions" :key="c.id" class="text-sm flex justify-between">
            <span>Cycle {{ c.cycleNumber }} R{{ c.roundNumber }}</span>
            <span>{{ formatNgwe(c.amountNgwe) }} · {{ c.status }}</span>
          </div>
          <p v-if="memberStatement.contributions.length === 0" class="text-sm text-slate-500">No contributions yet.</p>
        </div>
      </div>

      <div v-if="tab === 'ledger' && payoutLedger" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p v-if="payoutLedger.cycle" class="text-sm text-slate-600">
            Cycle #{{ payoutLedger.cycle.cycleNumber }} · {{ payoutLedger.cycle.status }}
          </p>
          <p v-else class="text-sm text-slate-500">No cycle data yet.</p>
          <button
            v-if="payoutLedger.rows.length"
            class="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-warm-50 disabled:opacity-50"
            :disabled="pdfLoading"
            @click="onDownloadPdf"
          >
            <Download class="w-4 h-4" />
            {{ pdfLoading ? 'Generating…' : 'Download PDF' }}
          </button>
        </div>

        <div v-if="payoutLedger.rows.length" class="bg-white rounded-2xl shadow-soft border border-warm-100 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-warm-50 text-left text-slate-500">
                <th class="px-4 py-3 font-medium">Month</th>
                <th class="px-4 py-3 font-medium">Recipients</th>
                <th class="px-4 py-3 font-medium">Amount</th>
                <th class="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-warm-50">
              <tr v-for="row in payoutLedger.rows" :key="row.roundId">
                <td class="px-4 py-3 font-medium text-slate-800">{{ row.monthLabel }}</td>
                <td class="px-4 py-3 text-slate-600">{{ row.recipients.join(', ') || '—' }}</td>
                <td class="px-4 py-3 text-slate-800">{{ row.amountLabel }}</td>
                <td class="px-4 py-3">
                  <span
                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="row.status === 'Paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'"
                  >
                    {{ row.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-slate-500 text-sm">No payout records yet. Open a cycle from the Cycles page.</p>
      </div>

      <div v-if="tab === 'loans' && loanBook" class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Active loans</p>
            <p class="font-display text-xl font-bold">{{ loanBook.activeCount }}</p>
          </div>
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
            <p class="text-xs text-slate-500">Outstanding</p>
            <p class="font-display text-xl font-bold">{{ formatNgwe(loanBook.totalOutstandingNgwe) }}</p>
          </div>
        </div>
        <div v-for="loan in loanBook.loans" :key="loan.id" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4">
          <div class="flex justify-between gap-3">
            <div>
              <p class="font-medium text-slate-800">{{ loan.member.firstName }} {{ loan.member.lastName }}</p>
              <p class="text-xs text-slate-500">{{ formatNgwe(loan.amountNgwe) }} → {{ formatNgwe(loan.totalDueNgwe) }} due</p>
            </div>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-warm-50 text-slate-700 capitalize h-fit">{{ loan.status }}</span>
          </div>
          <p class="text-sm text-slate-600 mt-2">Balance: {{ formatNgwe(loan.balanceNgwe) }}</p>
        </div>
        <p v-if="loanBook.loans.length === 0" class="text-slate-500 text-sm">No loans on record.</p>
      </div>
    </template>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
  </div>
</template>