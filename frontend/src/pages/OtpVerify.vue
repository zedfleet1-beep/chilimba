<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/api/client';
import AuthLayout from '@/layouts/AuthLayout.vue';
import OtpInput from '@/components/OtpInput.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const phone = (route.query.phone as string) || '';
const code = ref('');
const error = ref('');
const submitting = ref(false);
const resending = ref(false);
const resendCooldown = ref(60);

let cooldownTimer: number | undefined;

function startCooldown() {
  resendCooldown.value = 60;
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = window.setInterval(() => {
    resendCooldown.value = Math.max(0, resendCooldown.value - 1);
    if (resendCooldown.value === 0 && cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = undefined;
    }
  }, 1000);
}
startCooldown();

async function onComplete(value: string) {
  error.value = '';
  submitting.value = true;
  try {
    await auth.verifyOtp(phone, value);
    router.push({ name: 'dashboard' });
  } catch (e) {
    error.value = getErrorMessage(e);
    submitting.value = false;
  }
}

async function onResend() {
  if (resendCooldown.value > 0) return;
  resending.value = true;
  error.value = '';
  try {
    await auth.requestOtp(phone);
    startCooldown();
  } catch (e) {
    error.value = getErrorMessage(e, 'Could not resend code. Please try again.');
  } finally {
    resending.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h1 class="text-2xl font-semibold text-slate-900 mb-2">Verify your phone</h1>
    <p class="text-sm text-slate-500 mb-6">
      We sent a 6-digit code via WhatsApp to <span class="font-medium text-slate-700">{{ phone }}</span>.
      The code expires in 10 minutes.
    </p>

    <OtpInput
      v-model="code"
      :error="error"
      :disabled="submitting"
      @complete="onComplete"
    />

    <div class="mt-6 text-center">
      <button
        type="button"
        :disabled="resendCooldown > 0 || resending"
        @click="onResend"
        class="text-sm text-brand-600 hover:underline disabled:text-slate-400 disabled:no-underline"
      >
        {{ resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : resending ? 'Sending…' : 'Resend code' }}
      </button>
    </div>

    <div class="mt-6 pt-6 border-t border-slate-200 text-center">
      <router-link to="/signup" class="text-sm text-slate-500 hover:text-slate-700">← Use a different number</router-link>
    </div>
  </AuthLayout>
</template>
