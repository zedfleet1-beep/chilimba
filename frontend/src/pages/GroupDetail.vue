<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGroupsStore } from '@/stores/groups';
import { useAuthStore } from '@/stores/auth';
import { formatNgwe } from '@/lib/money';
import { getErrorMessage } from '@/api/client';
import { Plus, Settings as SettingsIcon, Users as UsersIcon, Trash2, X, RotateCw, BarChart3, HandCoins } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const store = useGroupsStore();

const tab = ref<'overview' | 'members'>('overview');
const showAdd = ref(false);
const addFirstName = ref('');
const addLastName = ref('');
const addPhone = ref('');
const addRole = ref<'member' | 'treasurer'>('member');
const addError = ref('');

const id = computed(() => String(route.params.id));

async function loadGroup() {
  if (!auth.isAuthenticated) return;
  if (id.value === 'list' || !id.value || id.value === 'undefined') {
    await store.fetchMine();
    if (store.groups.length > 0) {
      router.replace({ name: 'group-detail', params: { id: store.groups[0].id } });
    }
    return;
  }
  await store.fetchOne(id.value);
  if (store.error?.toLowerCase().includes('not a member')) {
    await store.fetchMine();
    const allowed = store.groups.find((g) => g.id === id.value);
    if (!allowed && store.groups[0]) {
      router.replace({ name: 'group-detail', params: { id: store.groups[0].id } });
    }
  }
}

onMounted(loadGroup);
watch(id, loadGroup);

const myRole = computed(() => store.current?.members?.find((m) => m.userId === auth.user?.id)?.role ?? null);
const canEditSettings = computed(() => myRole.value === 'owner');
const canAddMembers = computed(() => myRole.value === 'owner' || myRole.value === 'treasurer');

async function onAddMember() {
  addError.value = '';
  if (!addFirstName.value || !addLastName.value || !addPhone.value) {
    addError.value = 'First name, last name, and phone are required';
    return;
  }
  try {
    await store.addMember(id.value, {
      firstName: addFirstName.value,
      lastName: addLastName.value,
      phone: addPhone.value,
      role: addRole.value,
    });
    addFirstName.value = '';
    addLastName.value = '';
    addPhone.value = '';
    addRole.value = 'member';
    showAdd.value = false;
  } catch (e) {
    addError.value = getErrorMessage(e);
  }
}

async function onRemove(memberId: string) {
  if (!confirm('Remove this member? They will no longer be active in the group.')) return;
  try {
    await store.removeMember(id.value, memberId);
  } catch (e) {
    addError.value = getErrorMessage(e);
  }
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div v-if="store.loading" class="text-slate-500">Loading…</div>

    <div v-else-if="!store.current" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-10 text-center">
      <UsersIcon class="w-10 h-10 mx-auto text-warm-500 mb-3" />
      <p v-if="store.error" class="font-medium text-slate-700">{{ store.error }}</p>
      <template v-else>
        <p class="font-medium text-slate-700">You don't have a group yet</p>
        <p class="text-sm text-slate-500 mt-1">Pay an invoice and use the WhatsApp link to create one.</p>
      </template>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p class="text-xs text-slate-500 uppercase tracking-wide">{{ store.current.template.replace('_', ' ') }}</p>
            <h2 class="font-display text-2xl font-bold text-slate-900">{{ store.current.name }}</h2>
            <p v-if="store.current.description" class="text-sm text-slate-600 mt-1">{{ store.current.description }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              @click="router.push({ name: 'group-cycles', params: { id: id } })"
            >
              <RotateCw class="w-4 h-4" />
              Cycles
            </button>
            <button
              class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-warm-50"
              @click="router.push({ name: 'group-reports', params: { id: id } })"
            >
              <BarChart3 class="w-4 h-4" />
              Reports
            </button>
            <button
              v-if="store.current.settings?.allowLoans"
              class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-warm-50"
              @click="router.push({ name: 'group-loans', params: { id: id } })"
            >
              <HandCoins class="w-4 h-4" />
              Loans
            </button>
            <button
              v-if="canEditSettings"
              class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-warm-50"
              @click="router.push({ name: 'group-settings', params: { id: id } })"
            >
              <SettingsIcon class="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-warm-50">
          <div>
            <p class="text-xs text-slate-500">Members</p>
            <p class="font-display text-xl font-bold text-slate-900">{{ store.members.length }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Contribution</p>
            <p class="font-display text-xl font-bold text-slate-900">
              {{ store.current.settings ? formatNgwe(store.current.settings.contributionAmountNgwe) : '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Frequency</p>
            <p class="font-display text-xl font-bold text-slate-900">
              {{ store.current.settings?.contributionFrequency ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Payout/round</p>
            <p class="font-display text-xl font-bold text-slate-900">
              {{ store.current.settings?.payoutRecipientsCount ?? '—' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 border-b border-warm-100">
        <button
          v-for="t in ['overview', 'members'] as const"
          :key="t"
          class="px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize"
          :class="tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
          @click="tab = t"
        >
          {{ t }}
        </button>
      </div>

      <!-- Members tab -->
      <div v-if="tab === 'members'" class="bg-white rounded-2xl shadow-soft border border-warm-100">
        <div class="p-4 border-b border-warm-50 flex items-center justify-between">
          <h3 class="font-display text-lg font-semibold text-slate-900">Members</h3>
          <button
            v-if="canAddMembers"
            class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            @click="showAdd = true"
          >
            <Plus class="w-4 h-4" />
            Add member
          </button>
        </div>
        <ul v-if="store.members.length" class="divide-y divide-warm-50">
          <li v-for="m in store.members" :key="m.id" class="px-4 py-3 flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-warm-100 text-warm-600 flex items-center justify-center font-medium text-sm">
              {{ (m.user?.firstName ?? '?')[0] }}{{ (m.user?.lastName ?? '?')[0] }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-800">{{ m.user?.firstName }} {{ m.user?.lastName }}</p>
              <p class="text-xs text-slate-500 font-mono">{{ m.user?.phone }}</p>
            </div>
            <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-warm-50 text-slate-700 capitalize">{{ m.role }}</span>
            <span v-if="m.payoutPosition" class="text-xs text-slate-500">#{{ m.payoutPosition }}</span>
            <button
              v-if="canEditSettings && m.role !== 'owner'"
              class="text-slate-400 hover:text-coral-600 p-1"
              title="Remove"
              @click="onRemove(m.id)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </li>
        </ul>
        <div v-else class="p-8 text-center text-slate-500 text-sm">No active members yet.</div>
      </div>

      <!-- Overview tab -->
      <div v-else class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6 space-y-4">
        <h3 class="font-display text-lg font-semibold text-slate-900">Overview</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-slate-500">Grace period</p>
            <p class="font-medium text-slate-800">{{ store.current.settings?.gracePeriodDays ?? 0 }} days</p>
          </div>
          <div>
            <p class="text-slate-500">Late penalty</p>
            <p class="font-medium text-slate-800">
              {{ store.current.settings ? formatNgwe(store.current.settings.latePenaltyNgwe) : '—' }}
            </p>
          </div>
          <div>
            <p class="text-slate-500">Max members</p>
            <p class="font-medium text-slate-800">{{ store.current.settings?.maxMembers ?? '—' }}</p>
          </div>
          <div>
            <p class="text-slate-500">Loans</p>
            <p class="font-medium text-slate-800">
              {{ store.current.settings?.allowLoans ? `Allowed (max ${store.current.settings.maxLoanMultiplier}× savings, ${(store.current.settings.loanInterestRate * 100).toFixed(0)}% interest)` : 'Disabled' }}
            </p>
          </div>
        </div>
      </div>
    </template>

    <p v-if="addError || store.error" class="text-sm text-red-600">{{ addError || store.error }}</p>

    <!-- Add member modal -->
    <div v-if="showAdd" class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40">
      <div class="bg-white rounded-2xl shadow-xl border border-warm-100 w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-display text-lg font-semibold text-slate-900">Add a member</h3>
          <button class="text-slate-500 hover:text-slate-700" @click="showAdd = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <form class="space-y-3" @submit.prevent="onAddMember">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">First name *</label>
              <input
                v-model="addFirstName"
                required
                class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Last name *</label>
              <input
                v-model="addLastName"
                required
                class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Phone (E.164) *</label>
            <input
              v-model="addPhone"
              required
              placeholder="+260977123456"
              class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              v-model="addRole"
              class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
            >
              <option value="member">Member</option>
              <option value="treasurer">Treasurer</option>
            </select>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="px-4 h-10 rounded-lg text-slate-600 hover:bg-slate-50" @click="showAdd = false">
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 h-10 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700"
            >
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
