<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Check, MessageCircle, RefreshCw, Unlink } from 'lucide-vue-next';
import * as waApi from '@/api/whatsappGroupLink';
import { getErrorMessage } from '@/api/client';

const props = defineProps<{ groupId: string }>();
const emit = defineEmits<{ linked: [] }>();

const loading = ref(false);
const linkInfo = ref<waApi.WhatsappLinkInfo | null>(null);
const groups = ref<waApi.WhatsappGroupOption[]>([]);
const selectedJid = ref('');
const verifyCode = ref('');
const error = ref('');
const success = ref('');
const step = ref<'pick' | 'verify'>('pick');

const selectedGroup = computed(() => groups.value.find((g) => g.jid === selectedJid.value) ?? null);
const botPhoneDisplay = computed(() => {
  const p = linkInfo.value?.botPhone;
  if (!p) return 'the Chilimba WhatsApp number';
  if (p.startsWith('+')) return p;
  if (p.startsWith('260')) return `+${p}`;
  return p;
});

async function loadInfo() {
  try {
    linkInfo.value = await waApi.getLinkInfo(props.groupId);
    if (linkInfo.value.pending) {
      step.value = 'verify';
      selectedJid.value = linkInfo.value.pending.jid;
    }
  } catch (e) {
    error.value = getErrorMessage(
      e,
      'Could not load WhatsApp link status. Try refreshing the page or restarting the backend.',
    );
    throw e;
  }
}

async function refreshGroups() {
  loading.value = true;
  error.value = '';
  success.value = '';
  try {
    await loadInfo();
    groups.value = await waApi.listLinkableGroups(props.groupId);
    if (groups.value.length === 0) {
      error.value = 'No groups found yet. Add the Chilimba number to your WhatsApp group, then refresh.';
    }
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onSendCode() {
  if (!selectedJid.value) return;
  loading.value = true;
  error.value = '';
  success.value = '';
  try {
    const result = await waApi.sendVerification(props.groupId, {
      jid: selectedJid.value,
      subject: selectedGroup.value?.name,
    });
    success.value = result.message;
    step.value = 'verify';
    await loadInfo();
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onVerify() {
  loading.value = true;
  error.value = '';
  success.value = '';
  try {
    const result = await waApi.verifyLink(props.groupId, verifyCode.value.trim());
    success.value = `Linked to ${result.linked.subject ?? 'WhatsApp group'}.`;
    verifyCode.value = '';
    step.value = 'pick';
    await loadInfo();
    emit('linked');
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onUnlink() {
  if (!confirm('Disconnect this WhatsApp group from Chilimba?')) return;
  loading.value = true;
  error.value = '';
  try {
    await waApi.unlinkGroup(props.groupId);
    success.value = 'WhatsApp group disconnected.';
    await loadInfo();
    emit('linked');
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(refreshGroups);
</script>

<template>
  <div class="border-t border-warm-50 pt-4 space-y-4">
    <div class="flex items-center gap-2">
      <MessageCircle class="w-4 h-4 text-brand-600" />
      <h3 class="font-display text-sm font-semibold text-slate-700">WhatsApp group</h3>
    </div>
    <p class="text-xs text-slate-500">
      Post cycle updates to your group's WhatsApp chat. We verify ownership by sending a code to the group.
    </p>

    <div
      v-if="linkInfo?.linked"
      class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div class="flex items-center gap-2 text-sm text-emerald-800">
        <Check class="w-4 h-4 shrink-0" />
        <span>WhatsApp group linked</span>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-emerald-300 text-sm text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        :disabled="loading"
        @click="onUnlink"
      >
        <Unlink class="w-4 h-4" />
        Disconnect
      </button>
    </div>

    <template v-else>
      <ol class="text-sm text-slate-600 space-y-2 list-decimal list-inside">
        <li>
          Add <strong class="text-slate-800">{{ botPhoneDisplay }}</strong> to your savings group's WhatsApp chat.
        </li>
        <li>Refresh the list below and select your group.</li>
        <li>We send a 6-digit code in the group — enter it here to confirm.</li>
      </ol>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-warm-50 disabled:opacity-50"
          :disabled="loading"
          @click="refreshGroups"
        >
          <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
          Refresh groups
        </button>
      </div>

      <div v-if="step === 'pick'" class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Select your WhatsApp group</label>
          <select
            v-model="selectedJid"
            class="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
          >
            <option value="">Choose a group…</option>
            <option v-for="g in groups" :key="g.jid" :value="g.jid">
              {{ g.name }}{{ g.participantCount ? ` (${g.participantCount} members)` : '' }}
            </option>
          </select>
        </div>
        <button
          type="button"
          class="h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          :disabled="loading || !selectedJid"
          @click="onSendCode"
        >
          Send verification code to group
        </button>
      </div>

      <div v-else class="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
        <p class="text-sm text-slate-700">
          Check your WhatsApp group
          <strong v-if="linkInfo?.pending?.subject">{{ linkInfo.pending.subject }}</strong>
          for the 6-digit code, then enter it below.
        </p>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Verification code</label>
          <input
            v-model="verifyCode"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="123456"
            class="w-full max-w-xs h-10 px-3 rounded-lg border border-slate-200 font-mono tracking-widest text-center"
          />
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            :disabled="loading || verifyCode.length !== 6"
            @click="onVerify"
          >
            Verify &amp; link group
          </button>
          <button
            type="button"
            class="h-10 px-4 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-warm-50"
            :disabled="loading"
            @click="step = 'pick'"
          >
            Choose different group
          </button>
        </div>
      </div>
    </template>

    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <p v-if="success" class="text-sm text-brand-700">{{ success }}</p>
  </div>
</template>