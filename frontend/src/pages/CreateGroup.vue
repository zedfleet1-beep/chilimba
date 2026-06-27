<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createGroupFromToken, lookupInvoiceByToken, type CreateGroupInput } from '@/api/groups';
import { formatNgwe } from '@/lib/money';
import { getErrorMessage } from '@/api/client';
import { ArrowRight, PartyPopper, AlertCircle, CheckCircle2 } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();

const token = computed(() => String(route.query.token ?? ''));
const hasToken = computed(() => token.value.length > 0);

const invoiceNumber = ref<string | null>(null);
const amountNgwe = ref<string | null>(null);
const tokenError = ref<string | null>(null);

const name = ref('');
const description = ref('');
const template = ref<'rotating_cash' | 'grocery' | 'custom'>('rotating_cash');
const country = ref('ZM');
const currency = ref('ZMW');

const submitting = ref(false);
const submitError = ref('');
const done = ref<{ groupId: string; name: string } | null>(null);

onMounted(async () => {
  if (!hasToken.value) {
    tokenError.value = 'No token provided. Please use the link from your WhatsApp message.';
    return;
  }
  try {
    const inv = await lookupInvoiceByToken(token.value);
    invoiceNumber.value = inv.invoiceNumber;
    amountNgwe.value = inv.amountNgwe;
  } catch (e) {
    tokenError.value = getErrorMessage(e, 'This link is invalid or has expired.');
  }
});

async function onSubmit() {
  submitError.value = '';
  if (!name.value.trim()) {
    submitError.value = 'Please give your group a name';
    return;
  }
  submitting.value = true;
  try {
    const input: CreateGroupInput = {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      template: template.value,
      country: country.value,
      currency: currency.value,
    };
    const result = await createGroupFromToken(token.value, input);
    done.value = { groupId: result.group.id, name: result.group.name };
  } catch (e) {
    submitError.value = getErrorMessage(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-cream-50 flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
      <div class="text-center mb-6">
        <h1 class="font-display text-3xl font-bold text-slate-900">Create your group</h1>
        <p class="text-sm text-slate-500 mt-1">Almost there — give your savings circle a name and pick a template.</p>
      </div>

      <!-- Success -->
      <div v-if="done" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-8 text-center">
        <PartyPopper class="w-12 h-12 mx-auto text-brand-600 mb-3" />
        <h2 class="font-display text-2xl font-bold text-slate-900">Welcome aboard, {{ done.name }}!</h2>
        <p class="text-sm text-slate-500 mt-2">Your group is ready. Sign in to invite members and open your first cycle.</p>
        <button
          class="mt-6 inline-flex items-center gap-2 px-5 h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700"
          @click="router.push({ name: 'login', query: { next: `/groups/${done.groupId}` } })"
        >
          Sign in
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

      <!-- Invalid token -->
      <div v-else-if="tokenError" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-8 text-center">
        <AlertCircle class="w-10 h-10 mx-auto text-warm-600 mb-3" />
        <h2 class="font-display text-xl font-bold text-slate-900">Link expired</h2>
        <p class="text-sm text-slate-500 mt-2">{{ tokenError }}</p>
        <button
          class="mt-6 inline-flex items-center gap-2 px-5 h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700"
          @click="router.push({ name: 'login' })"
        >
          Back to sign in
        </button>
      </div>

      <!-- Form -->
      <div v-else class="bg-white rounded-2xl shadow-soft border border-warm-100 p-8">
        <div v-if="invoiceNumber" class="mb-5 p-3 rounded-lg bg-warm-50 border border-warm-100 text-sm text-slate-700">
          <CheckCircle2 class="w-4 h-4 inline-block text-brand-600 mr-1.5 -mt-0.5" />
          Payment confirmed for invoice <span class="font-mono">{{ invoiceNumber }}</span>
          <span v-if="amountNgwe"> — {{ formatNgwe(amountNgwe) }}</span>
        </div>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Group name *</label>
            <input
              v-model="name"
              required
              maxlength="200"
              placeholder="e.g. Lusaka Women's Chilimba 2026"
              class="w-full h-11 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              v-model="description"
              rows="2"
              maxlength="1000"
              placeholder="What is this group for?"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Template *</label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label
                v-for="t in [
                  { value: 'rotating_cash', label: 'Rotating cash', hint: '2 recipients/round' },
                  { value: 'grocery', label: 'Grocery', hint: 'Loans allowed' },
                  { value: 'custom', label: 'Custom', hint: 'Start small' },
                ]"
                :key="t.value"
                class="cursor-pointer border rounded-lg p-3 text-center"
                :class="template === t.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-warm-200'"
              >
                <input v-model="template" type="radio" :value="t.value" class="sr-only" />
                <p class="font-medium text-slate-800 text-sm">{{ t.label }}</p>
                <p class="text-xs text-slate-500">{{ t.hint }}</p>
              </label>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Country</label>
              <input
                v-model="country"
                maxlength="2"
                class="w-full h-11 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <input
                v-model="currency"
                maxlength="3"
                class="w-full h-11 px-3 rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
              />
            </div>
          </div>

          <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            <span>{{ submitting ? 'Creating your group…' : 'Create group' }}</span>
            <ArrowRight v-if="!submitting" class="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
