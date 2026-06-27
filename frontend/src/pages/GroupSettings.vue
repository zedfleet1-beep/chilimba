<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupsStore } from '@/stores/groups';
import { formatNgwe, parseNgwe } from '@/lib/money';
import { getErrorMessage } from '@/api/client';
import { ArrowLeft } from 'lucide-vue-next';
import WhatsappGroupLink from '@/components/WhatsappGroupLink.vue';

const route = useRoute();
const router = useRouter();
const store = useGroupsStore();
const auth = useAuthStore();
const id = computed(() => String(route.params.id));

onMounted(async () => {
  await store.fetchOne(id.value);
  const myRole = store.current?.members?.find((m) => m.userId === auth.user?.id)?.role;
  if (myRole !== 'owner') {
    router.replace({ name: 'group-detail', params: { id: id.value } });
    return;
  }
  if (store.current?.settings) {
    const s = store.current.settings;
    name.value = store.current.name;
    description.value = store.current.description ?? '';
    maxMembers.value = s.maxMembers;
    contributionKwacha.value = formatNgwe(s.contributionAmountNgwe).replace(/^K/, '');
    frequency.value = s.contributionFrequency;
    gracePeriodDays.value = s.gracePeriodDays;
    latePenaltyKwacha.value = formatNgwe(s.latePenaltyNgwe).replace(/^K/, '');
    payoutRecipients.value = s.payoutRecipientsCount;
    payoutMethod.value = s.payoutMethod;
    allowLoans.value = s.allowLoans;
    reminderDaysBefore.value = s.reminderDaysBefore;
    whatsappReminders.value = s.whatsappReminders;
    autoOpenNextCycle.value = s.autoOpenNextCycle ?? false;
  }
});

async function onWhatsappLinked() {
  await store.fetchOne(id.value);
}

const name = ref('');
const description = ref('');
const maxMembers = ref(20);
const contributionKwacha = ref('');
const frequency = ref<'weekly' | 'fortnightly' | 'monthly'>('monthly');
const gracePeriodDays = ref(5);
const latePenaltyKwacha = ref('0');
const payoutRecipients = ref(1);
const payoutMethod = ref<'queue' | 'random' | 'manual' | 'voting'>('queue');
const allowLoans = ref(false);
const reminderDaysBefore = ref(1);
const whatsappReminders = ref(true);
const autoOpenNextCycle = ref(false);

const saving = ref(false);
const saveError = ref('');
const saved = ref(false);

async function onSave() {
  saveError.value = '';
  saved.value = false;
  saving.value = true;
  try {
    const amountNgwe = parseNgwe(contributionKwacha.value);
    const lateNgwe = parseNgwe(latePenaltyKwacha.value) ?? 0n;
    if (amountNgwe === null) {
      saveError.value = 'Enter a valid contribution amount';
      return;
    }
    await store.updateSettings(id.value, {
      name: name.value,
      description: description.value || null,
      maxMembers: maxMembers.value,
      contributionAmountNgwe: amountNgwe.toString(),
      contributionFrequency: frequency.value,
      gracePeriodDays: gracePeriodDays.value,
      latePenaltyNgwe: lateNgwe.toString(),
      payoutRecipientsCount: payoutRecipients.value,
      payoutMethod: payoutMethod.value,
      allowLoans: allowLoans.value,
      reminderDaysBefore: reminderDaysBefore.value,
      whatsappReminders: whatsappReminders.value,
      autoOpenNextCycle: autoOpenNextCycle.value,
    });
    saved.value = true;
  } catch (e) {
    saveError.value = getErrorMessage(e);
  } finally {
    saving.value = false;
  }
}

watch(saved, (v) => {
  if (v) setTimeout(() => (saved.value = false), 2500);
});
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <button
      class="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      @click="router.push({ name: 'group-detail', params: { id: id } })"
    >
      <ArrowLeft class="w-4 h-4" />
      Back to group
    </button>

    <div v-if="!store.current" class="text-slate-500">Loading…</div>

    <form v-else class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6 space-y-5" @submit.prevent="onSave">
      <h2 class="font-display text-2xl font-bold text-slate-900">Group settings</h2>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Group name</label>
        <input
          v-model="name"
          required
          class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          v-model="description"
          rows="2"
          class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Max members</label>
          <input
            v-model.number="maxMembers"
            type="number"
            min="2"
            max="200"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Payout recipients / round</label>
          <input
            v-model.number="payoutRecipients"
            type="number"
            min="0"
            max="20"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Contribution (Kwacha)</label>
          <input
            v-model="contributionKwacha"
            type="text"
            placeholder="1000.00"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
          <select
            v-model="frequency"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
          >
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Grace period (days)</label>
          <input
            v-model.number="gracePeriodDays"
            type="number"
            min="0"
            max="60"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Late penalty (Kwacha)</label>
          <input
            v-model="latePenaltyKwacha"
            type="text"
            placeholder="0.00"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Payout method</label>
        <select
          v-model="payoutMethod"
          class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
        >
          <option value="queue">Queue (in order)</option>
          <option value="random">Random</option>
          <option value="manual">Manual</option>
          <option value="voting">Voting</option>
        </select>
      </div>

      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="allowLoans" type="checkbox" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
        Allow members to take loans
      </label>

      <div class="border-t border-warm-50 pt-4 space-y-3">
        <h3 class="font-display text-sm font-semibold text-slate-700">Cycle automation</h3>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="autoOpenNextCycle" type="checkbox" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          Auto-open next cycle when the current one completes
        </label>
      </div>

      <WhatsappGroupLink :group-id="id" @linked="onWhatsappLinked" />

      <div class="border-t border-warm-50 pt-4 space-y-3">
        <h3 class="font-display text-sm font-semibold text-slate-700">Reminders</h3>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="whatsappReminders" type="checkbox" class="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          Send WhatsApp reminders
        </label>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Days before due date</label>
          <input
            v-model.number="reminderDaysBefore"
            type="number"
            min="0"
            max="30"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
      </div>

      <p v-if="saveError" class="text-sm text-red-600">{{ saveError }}</p>
      <p v-if="saved" class="text-sm text-brand-700">✓ Settings saved.</p>

      <div class="flex justify-end pt-2">
        <button
          type="submit"
          :disabled="saving"
          class="px-5 h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </div>
    </form>
  </div>
</template>
