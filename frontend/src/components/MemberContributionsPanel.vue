<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, ChevronDown, ChevronUp, Eye, FileUp, MoreHorizontal } from 'lucide-vue-next';
import type { Contribution } from '@/api/cycles';
import type { GroupMember } from '@/api/groups';
import { formatNgwe } from '@/lib/money';

const props = defineProps<{
  members: GroupMember[];
  contributions: Contribution[];
  amountNgwe: string;
  collectedNgwe: string;
  isOwner: boolean;
  saving: boolean;
}>();

const emit = defineEmits<{
  review: [memberId: string];
  record: [memberId: string];
  waive: [memberId: string];
  upload: [memberId: string, file: File];
}>();

type Filter = 'action' | 'all' | 'done';

const filter = ref<Filter>('action');
const doneExpanded = ref(false);
const menuOpenId = ref<string | null>(null);

const contributionByMember = computed(
  () => new Map(props.contributions.map((c) => [c.memberId, c])),
);

interface MemberRow {
  member: GroupMember;
  status: string;
  proofUrl: string | null;
  needsReview: boolean;
  isWaiting: boolean;
  isDone: boolean;
}

const rows = computed((): MemberRow[] =>
  props.members.map((member) => {
    const contribution = contributionByMember.value.get(member.id);
    const status = contribution?.status ?? 'pending';
    const proofUrl = contribution?.proofUrl ?? null;
    const isDone = ['paid', 'late', 'waived'].includes(status);
    const needsReview = status === 'pending' && !!proofUrl;
    const isWaiting = status === 'pending' && !proofUrl;
    return { member, status, proofUrl, needsReview, isWaiting, isDone };
  }),
);

const needsReview = computed(() => rows.value.filter((r) => r.needsReview));
const stillWaiting = computed(() => rows.value.filter((r) => r.isWaiting));
const done = computed(() => rows.value.filter((r) => r.isDone));

const paidCount = computed(() => done.value.length);
const totalCount = computed(() => props.members.length);

function statusTone(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700';
    case 'late':
      return 'bg-coral-50 text-coral-700';
    case 'waived':
      return 'bg-warm-100 text-warm-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function initials(member: GroupMember) {
  const first = member.user?.firstName?.[0] ?? '';
  const last = member.user?.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || '?';
}

function memberName(member: GroupMember) {
  return member.user ? `${member.user.firstName} ${member.user.lastName}` : 'Member';
}

function onFileInput(memberId: string, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) emit('upload', memberId, file);
  (event.target as HTMLInputElement).value = '';
}

function toggleMenu(memberId: string) {
  menuOpenId.value = menuOpenId.value === memberId ? null : memberId;
}

function closeMenu() {
  menuOpenId.value = null;
}
</script>

<template>
  <div class="bg-white rounded-2xl shadow-soft border border-warm-100">
    <div class="p-4 border-b border-warm-50 space-y-3">
      <div>
        <h3 class="font-display text-lg font-semibold text-slate-900">Member collections</h3>
        <p class="text-sm text-slate-500 mt-0.5">
          {{ formatNgwe(collectedNgwe) }} collected · {{ paidCount }} of {{ totalCount }} paid
        </p>
        <p v-if="needsReview.length > 0" class="text-sm text-sky-800 mt-1">
          {{ needsReview.length }} proof{{ needsReview.length === 1 ? '' : 's' }} ready to review — tap <strong>Review</strong> to approve.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          :class="filter === 'action' ? 'bg-brand-100 text-brand-800' : 'bg-warm-50 text-slate-600 hover:bg-warm-100'"
          @click="filter = 'action'"
        >
          Needs action
          <span v-if="needsReview.length + stillWaiting.length > 0" class="ml-1 opacity-80">
            ({{ needsReview.length + stillWaiting.length }})
          </span>
        </button>
        <button
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          :class="filter === 'all' ? 'bg-brand-100 text-brand-800' : 'bg-warm-50 text-slate-600 hover:bg-warm-100'"
          @click="filter = 'all'"
        >
          Everyone
        </button>
        <button
          class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
          :class="filter === 'done' ? 'bg-brand-100 text-brand-800' : 'bg-warm-50 text-slate-600 hover:bg-warm-100'"
          @click="filter = 'done'"
        >
          Paid
          <span v-if="paidCount > 0" class="ml-1 opacity-80">({{ paidCount }})</span>
        </button>
      </div>
    </div>

    <div class="p-4 space-y-5">
      <p
        v-if="filter === 'action' && needsReview.length === 0 && stillWaiting.length === 0"
        class="text-sm text-slate-500 text-center py-6"
      >
        All caught up — no payments need your attention this month.
      </p>

      <section v-if="(filter === 'action' || filter === 'all') && needsReview.length > 0" class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-sky-700">Review proof</p>
        <div
          v-for="row in needsReview"
          :key="row.member.id"
          class="flex items-center gap-3 p-3 rounded-xl border border-sky-100 bg-sky-50/40"
        >
          <div class="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center text-sm font-semibold shrink-0">
            {{ initials(row.member) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-800 truncate">{{ memberName(row.member) }}</p>
            <p class="text-xs text-slate-500">{{ formatNgwe(amountNgwe) }} · proof uploaded</p>
          </div>
          <button
            class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 shrink-0"
            @click="emit('review', row.member.id)"
          >
            <Eye class="w-4 h-4" />
            Review
          </button>
        </div>
      </section>

      <section v-if="(filter === 'action' || filter === 'all') && stillWaiting.length > 0" class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Still waiting</p>
        <div
          v-for="row in stillWaiting"
          :key="row.member.id"
          class="flex items-center gap-3 p-3 rounded-xl border border-warm-100"
        >
          <div class="w-10 h-10 rounded-full bg-warm-100 text-slate-700 flex items-center justify-center text-sm font-semibold shrink-0">
            {{ initials(row.member) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-800 truncate">{{ memberName(row.member) }}</p>
            <p class="text-xs text-slate-500">{{ formatNgwe(amountNgwe) }} · no proof yet</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              class="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
              :disabled="saving"
              @click="emit('record', row.member.id)"
            >
              <Check class="w-4 h-4" />
              Record cash
            </button>
            <label
              class="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-warm-50 cursor-pointer"
              title="Upload POP on their behalf"
            >
              <FileUp class="w-4 h-4" />
              <input class="sr-only" type="file" accept="image/*,application/pdf" @change="onFileInput(row.member.id, $event)" />
            </label>
            <div v-if="isOwner" class="relative">
              <button
                class="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-warm-50"
                aria-label="More actions"
                @click="toggleMenu(row.member.id)"
              >
                <MoreHorizontal class="w-4 h-4" />
              </button>
              <div
                v-if="menuOpenId === row.member.id"
                class="absolute right-0 top-full mt-1 z-10 bg-white border border-warm-100 rounded-lg shadow-lg py-1 min-w-28"
              >
                <button
                  class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-warm-50 disabled:opacity-60"
                  :disabled="saving"
                  @click="emit('waive', row.member.id); closeMenu()"
                >
                  Waive payment
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="(filter === 'all' || filter === 'done') && done.length > 0"
        class="space-y-2"
      >
        <button
          v-if="filter === 'all'"
          class="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-emerald-700"
          @click="doneExpanded = !doneExpanded"
        >
          Paid this month ({{ done.length }})
          <component :is="doneExpanded ? ChevronUp : ChevronDown" class="w-3.5 h-3.5" />
        </button>
        <p v-else class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Paid this month</p>

        <template v-if="filter === 'done' || doneExpanded">
          <div
            v-for="row in done"
            :key="row.member.id"
            class="flex items-center gap-3 p-3 rounded-xl border border-warm-50 bg-warm-50/30"
          >
            <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-semibold shrink-0">
              {{ initials(row.member) }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800 truncate">{{ memberName(row.member) }}</p>
              <p class="text-xs text-slate-500">{{ formatNgwe(amountNgwe) }}</p>
            </div>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0" :class="statusTone(row.status)">
              {{ row.status }}
            </span>
            <button
              v-if="row.proofUrl"
              class="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-white shrink-0"
              @click="emit('review', row.member.id)"
            >
              <Eye class="w-3.5 h-3.5" />
              Receipt
            </button>
          </div>
        </template>
      </section>

      <p v-if="filter === 'done' && done.length === 0" class="text-sm text-slate-500 text-center py-6">
        No paid contributions yet this month.
      </p>
    </div>
  </div>
</template>