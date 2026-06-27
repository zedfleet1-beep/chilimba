<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Check, FileUp, Play, Plus, RefreshCw, RotateCw, WalletCards } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { useCyclesStore } from '@/stores/cycles';
import { formatNgwe } from '@/lib/money';
import { formatRoundLabel, cycleProgress, periodLabel } from '@/lib/roundLabels';
import { getErrorMessage } from '@/api/client';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const groups = useGroupsStore();
const cycles = useCyclesStore();

const localError = ref('');
const payoutNotes = ref('');
const payoutFile = ref<File | undefined>();
const showAssignModal = ref(false);
const selectedRecipientIds = ref<string[]>([]);

const groupId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const group = computed(() => groups.current);
const members = computed(() => groups.members);
const myRole = computed(() => members.value.find((member) => member.userId === auth.user?.id)?.role ?? null);
const isOwner = computed(() => myRole.value === 'owner');
const canManageMoney = computed(() => myRole.value === 'owner' || myRole.value === 'treasurer');
const selectedRound = computed(() => cycles.selectedRound);
const contributionByMember = computed(() => new Map(cycles.contributions.map((item) => [item.memberId, item])));
const frequency = computed(() => group.value?.settings?.contributionFrequency ?? 'monthly');
const payoutRecipientCount = computed(() => group.value?.settings?.payoutRecipientsCount ?? 1);
const isManualPayout = computed(() => group.value?.settings?.payoutMethod === 'manual');

const progress = computed(() => {
  if (!cycles.current?.rounds.length) return null;
  const total = cycles.current.rounds.length;
  const completed = cycles.current.rounds.filter((r) => r.status === 'completed').length;
  const active = cycles.current.rounds.find((r) => r.status !== 'completed');
  const currentNum = active?.roundNumber ?? (completed > 0 ? completed : 1);
  return cycleProgress(currentNum, total, frequency.value);
});

function roundLabel(roundNumber: number, dueDate: string) {
  return formatRoundLabel(roundNumber, dueDate, frequency.value);
}
async function loadForRoute() {
  localError.value = '';
  if (!groupId.value) {
    await groups.fetchMine();
    const firstGroup = groups.groups[0];
    if (firstGroup) {
      router.replace({ name: 'group-cycles', params: { id: firstGroup.id } });
    }
    return;
  }
  await groups.fetchOne(groupId.value);
  await cycles.fetchCycles(groupId.value);
}

function memberName(memberId: string) {
  const member = members.value.find((item) => item.id === memberId);
  return member?.user ? `${member.user.firstName} ${member.user.lastName}` : 'Member';
}

function statusTone(status: string) {
  switch (status) {
    case 'paid':
    case 'completed':
      return 'bg-emerald-50 text-emerald-700';
    case 'late':
      return 'bg-coral-50 text-coral-700';
    case 'collecting':
    case 'in_progress':
      return 'bg-sky-50 text-sky-700';
    case 'waived':
      return 'bg-warm-100 text-warm-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

async function runAction(action: () => Promise<void>) {
  localError.value = '';
  try {
    await action();
  } catch (e) {
    localError.value = getErrorMessage(e);
  }
}

async function onOpenCycle() {
  await runAction(() => cycles.open(groupId.value));
}

async function onStartCycle() {
  await runAction(() => cycles.start(groupId.value));
}

async function onCompleteCycle() {
  if (!confirm('Complete this cycle now?')) return;
  await runAction(() => cycles.complete(groupId.value));
}

async function onSelectRound(roundId: string) {
  await cycles.selectRound(groupId.value, roundId);
}

async function onProofChange(memberId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  await runAction(() => cycles.uploadProof(groupId.value, memberId, file));
  input.value = '';
}

async function onPayoutFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  payoutFile.value = input.files?.[0];
}

async function onRecordPayout() {
  await runAction(async () => {
    await cycles.recordPayout(groupId.value, { notes: payoutNotes.value || undefined, file: payoutFile.value });
    payoutNotes.value = '';
    payoutFile.value = undefined;
  });
}

function openAssignModal() {
  selectedRecipientIds.value = cycles.payouts.map((p) => p.memberId);
  showAssignModal.value = true;
}

function toggleRecipient(memberId: string) {
  const idx = selectedRecipientIds.value.indexOf(memberId);
  if (idx >= 0) {
    selectedRecipientIds.value.splice(idx, 1);
    return;
  }
  if (selectedRecipientIds.value.length >= payoutRecipientCount.value) return;
  selectedRecipientIds.value.push(memberId);
}

async function onAssignRecipients() {
  if (selectedRecipientIds.value.length !== payoutRecipientCount.value) return;
  await runAction(async () => {
    await cycles.assignRecipients(groupId.value, [...selectedRecipientIds.value]);
    showAssignModal.value = false;
  });
}

onMounted(loadForRoute);
watch(() => route.params.id, loadForRoute);
</script>

<template>
  <div class="max-w-6xl space-y-6">
    <div v-if="groups.loading || cycles.loading" class="text-slate-500">Loading...</div>

    <div v-else-if="!group" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-10 text-center">
      <WalletCards class="w-10 h-10 mx-auto text-warm-500 mb-3" />
      <p class="font-medium text-slate-700">No group found</p>
    </div>

    <template v-else>
      <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500">{{ group.name }}</p>
            <h2 class="font-display text-2xl font-bold text-slate-900">Cycles</h2>
            <div class="flex flex-wrap gap-2 mt-3 text-xs">
              <span class="px-2 py-1 rounded-full bg-warm-50 text-slate-700">
                {{ group.settings ? formatNgwe(group.settings.contributionAmountNgwe) : 'K0.00' }} per member
              </span>
              <span class="px-2 py-1 rounded-full bg-warm-50 text-slate-700">
                {{ group.settings?.contributionFrequency ?? 'monthly' }}
              </span>
              <span class="px-2 py-1 rounded-full bg-warm-50 text-slate-700">
                {{ group.settings?.payoutRecipientsCount ?? 1 }} payout recipients
              </span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-if="isOwner && !cycles.current"
              class="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
              :disabled="cycles.saving"
              @click="onOpenCycle"
            >
              <Plus class="w-4 h-4" />
              Open cycle
            </button>
            <button
              v-if="isOwner && cycles.current?.status === 'open'"
              class="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
              :disabled="cycles.saving"
              @click="onStartCycle"
            >
              <Play class="w-4 h-4" />
              Start
            </button>
            <button
              v-if="isOwner && cycles.current && cycles.current.status !== 'completed'"
              class="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-warm-50"
              :disabled="cycles.saving"
              @click="onCompleteCycle"
            >
              <Check class="w-4 h-4" />
              Complete
            </button>
            <button
              class="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-warm-50"
              @click="loadForRoute"
            >
              <RefreshCw class="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div v-if="cycles.current" class="mt-5 pt-5 border-t border-warm-50 space-y-4">
          <div v-if="progress" class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-slate-800">{{ progress.label }}</span>
              <span class="text-slate-500">{{ progress.percent }}%</span>
            </div>
            <div class="h-2.5 rounded-full bg-warm-100 overflow-hidden">
              <div
                class="h-full rounded-full bg-brand-500 transition-all"
                :style="{ width: `${progress.percent}%` }"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p class="text-xs text-slate-500">Cycle</p>
              <p class="font-display text-xl font-bold text-slate-900">#{{ cycles.current.cycleNumber }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Status</p>
              <span class="inline-flex mt-1 px-2 py-1 rounded-full text-xs font-medium capitalize" :class="statusTone(cycles.current.status)">
                {{ cycles.current.status.replace('_', ' ') }}
              </span>
            </div>
            <div>
              <p class="text-xs text-slate-500">{{ periodLabel(frequency) }}s</p>
              <p class="font-display text-xl font-bold text-slate-900">{{ cycles.current.rounds.length }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Members</p>
              <p class="font-display text-xl font-bold text-slate-900">{{ members.length }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!cycles.current" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-10 text-center">
        <p class="font-medium text-slate-700">No cycle is open</p>
        <p class="text-sm text-slate-500 mt-1">The owner can open the first rotation when members and settings are ready.</p>
      </div>

      <template v-else>
        <div class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="round in cycles.current.rounds"
            :key="round.id"
            class="shrink-0 px-4 py-3 rounded-xl border text-left min-w-40"
            :class="selectedRound?.id === round.id ? 'bg-white border-brand-300 shadow-soft' : 'bg-white/70 border-warm-100 hover:bg-white'"
            @click="onSelectRound(round.id)"
          >
            <p class="text-sm font-semibold text-slate-900">{{ roundLabel(round.roundNumber, round.dueDate) }}</p>
            <p class="text-xs text-slate-500 mt-1">{{ new Date(round.dueDate).toLocaleDateString() }}</p>
            <span class="inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium capitalize" :class="statusTone(round.status)">
              {{ round.status.replace('_', ' ') }}
            </span>
          </button>
        </div>

        <div v-if="selectedRound" class="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-6">
          <div class="bg-white rounded-2xl shadow-soft border border-warm-100">
            <div class="p-4 border-b border-warm-50 flex items-center justify-between gap-3">
              <div>
                <h3 class="font-display text-lg font-semibold text-slate-900">{{ roundLabel(selectedRound.roundNumber, selectedRound.dueDate) }} contributions</h3>
                <p class="text-sm text-slate-500">{{ formatNgwe(selectedRound.totalCollectedNgwe) }} collected</p>
              </div>
            </div>

            <div class="divide-y divide-warm-50">
              <div v-for="member in members" :key="member.id" class="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-slate-800">{{ member.user?.firstName }} {{ member.user?.lastName }}</p>
                  <p class="text-xs text-slate-500 font-mono">{{ member.user?.phone }}</p>
                </div>
                <span class="self-start lg:self-auto px-2 py-1 rounded-full text-xs font-medium capitalize" :class="statusTone(contributionByMember.get(member.id)?.status ?? 'pending')">
                  {{ contributionByMember.get(member.id)?.status ?? 'pending' }}
                </span>
                <div class="flex flex-wrap items-center gap-2">
                  <label
                    v-if="canManageMoney || member.userId === auth.user?.id"
                    class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-warm-50 cursor-pointer"
                  >
                    <FileUp class="w-4 h-4" />
                    POP
                    <input class="sr-only" type="file" accept="image/*,application/pdf" @change="onProofChange(member.id, $event)" />
                  </label>
                  <button
                    v-if="canManageMoney && !['paid', 'late', 'waived'].includes(contributionByMember.get(member.id)?.status ?? '')"
                    class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
                    :disabled="cycles.saving"
                    @click="runAction(() => cycles.record(groupId, member.id))"
                  >
                    <Check class="w-4 h-4" />
                    Record
                  </button>
                  <button
                    v-if="canManageMoney && contributionByMember.get(member.id)?.status === 'pending' && contributionByMember.get(member.id)?.proofUrl"
                    class="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-warm-50 disabled:opacity-60"
                    :disabled="cycles.saving"
                    @click="runAction(() => cycles.approve(groupId, member.id))"
                  >
                    Approve POP
                  </button>
                  <button
                    v-if="isOwner && !['paid', 'late', 'waived'].includes(contributionByMember.get(member.id)?.status ?? '')"
                    class="h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-warm-50 disabled:opacity-60"
                    :disabled="cycles.saving"
                    @click="runAction(() => cycles.waive(groupId, member.id))"
                  >
                    Waive
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside class="bg-white rounded-2xl shadow-soft border border-warm-100 p-4 space-y-4">
            <div>
              <h3 class="font-display text-lg font-semibold text-slate-900">Payouts</h3>
              <p class="text-sm text-slate-500">Recipients for {{ roundLabel(selectedRound.roundNumber, selectedRound.dueDate) }}</p>
            </div>

            <div class="space-y-2">
              <div
                v-for="payout in cycles.payouts"
                :key="payout.id"
                class="rounded-xl border border-warm-100 p-3"
              >
                <p class="text-sm font-medium text-slate-800">{{ memberName(payout.memberId) }}</p>
                <div class="flex items-center justify-between mt-2 text-xs">
                  <span class="text-slate-500">{{ formatNgwe(payout.amountNgwe) }}</span>
                  <span class="px-2 py-0.5 rounded-full font-medium" :class="payout.paidAt ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'">
                    {{ payout.paidAt ? 'paid' : 'waiting' }}
                  </span>
                </div>
              </div>
              <p v-if="cycles.payouts.length === 0" class="text-sm text-slate-500">No recipients assigned.</p>
            </div>

            <div v-if="canManageMoney && cycles.payouts.length > 0 && selectedRound.status !== 'completed'" class="space-y-3 pt-3 border-t border-warm-50">
              <textarea
                v-model="payoutNotes"
                rows="3"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                placeholder="Payout notes"
              />
              <input
                type="file"
                accept="image/*,application/pdf"
                class="block w-full text-sm text-slate-600"
                @change="onPayoutFileChange"
              />
              <button
                class="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
                :disabled="cycles.saving"
                @click="onRecordPayout"
              >
                <WalletCards class="w-4 h-4" />
                Record payout
              </button>
            </div>

            <button
              v-if="isOwner && isManualPayout && selectedRound.status !== 'completed'"
              class="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-warm-50"
              :disabled="cycles.saving"
              @click="openAssignModal"
            >
              <RotateCw class="w-4 h-4" />
              Pick recipients
            </button>

            <button
              v-if="isOwner && group.settings?.payoutMethod === 'random' && selectedRound.status !== 'completed'"
              class="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-warm-50"
              :disabled="cycles.saving"
              @click="runAction(() => cycles.reroll(groupId))"
            >
              <RotateCw class="w-4 h-4" />
              Reroll recipients
            </button>
          </aside>
        </div>
      </template>
    </template>

    <div
      v-if="showAssignModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      @click.self="showAssignModal = false"
    >
      <div class="bg-white rounded-2xl shadow-soft border border-warm-100 w-full max-w-md p-5 space-y-4">
        <h3 class="font-display text-lg font-semibold text-slate-900">Pick payout recipients</h3>
        <p class="text-sm text-slate-500">
          Select {{ payoutRecipientCount }} member{{ payoutRecipientCount === 1 ? '' : 's' }} for
          {{ selectedRound ? roundLabel(selectedRound.roundNumber, selectedRound.dueDate) : 'this month' }}.
        </p>
        <div class="space-y-2 max-h-64 overflow-y-auto">
          <label
            v-for="member in members"
            :key="member.id"
            class="flex items-center gap-3 p-3 rounded-xl border cursor-pointer"
            :class="selectedRecipientIds.includes(member.id) ? 'border-brand-300 bg-brand-50/50' : 'border-warm-100'"
          >
            <input
              type="checkbox"
              :checked="selectedRecipientIds.includes(member.id)"
              class="rounded border-slate-300 text-brand-600"
              @change="toggleRecipient(member.id)"
            />
            <span class="text-sm text-slate-800">{{ member.user?.firstName }} {{ member.user?.lastName }}</span>
          </label>
        </div>
        <div class="flex gap-2 justify-end">
          <button
            class="h-10 px-4 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-warm-50"
            @click="showAssignModal = false"
          >
            Cancel
          </button>
          <button
            class="h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            :disabled="cycles.saving || selectedRecipientIds.length !== payoutRecipientCount"
            @click="onAssignRecipients"
          >
            Save recipients
          </button>
        </div>
      </div>
    </div>

    <p v-if="localError || groups.error || cycles.error" class="text-sm text-red-600">
      {{ localError || groups.error || cycles.error }}
    </p>
  </div>
</template>
