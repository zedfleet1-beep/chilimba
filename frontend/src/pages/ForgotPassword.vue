<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/api/client';
import AuthLayout from '@/layouts/AuthLayout.vue';
import PhoneInput from '@/components/PhoneInput.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import OtpInput from '@/components/OtpInput.vue';
import { ArrowRight, Check, KeyRound } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const step = ref<'phone' | 'reset'>('phone');
const phone = ref('');
const code = ref('');
const password = ref('');
const confirmPassword = ref('');

const error = ref('');
const requesting = ref(false);
const submitting = ref(false);
const resending = ref(false);
const resendCooldown = ref(0);

let cooldownTimer: number | undefined;

const passwordValid = computed(
  () => password.value.length >= 8 && /[A-Z]/.test(password.value) && /\d/.test(password.value),
);

const canReset = computed(
  () =>
    code.value.length === 6 &&
    passwordValid.value &&
    password.value === confirmPassword.value &&
    !submitting.value,
);

onMounted(() => {
  const fromQuery = route.query.phone;
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    phone.value = fromQuery;
  }
});

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

async function onRequestCode() {
  error.value = '';
  requesting.value = true;
  try {
    await auth.forgotPassword(phone.value);
    step.value = 'reset';
    startCooldown();
  } catch (e) {
    error.value = getErrorMessage(e);
  } finally {
    requesting.value = false;
  }
}

async function onResend() {
  if (resendCooldown.value > 0) return;
  resending.value = true;
  error.value = '';
  try {
    await auth.forgotPassword(phone.value);
    startCooldown();
  } catch (e) {
    error.value = getErrorMessage(e, 'Could not resend code. Please try again.');
  } finally {
    resending.value = false;
  }
}

async function onComplete(value: string) {
  code.value = value;
  if (!canReset.value) return;
  await submitReset(value);
}

async function onSubmit() {
  if (code.value.length !== 6) return;
  await submitReset(code.value);
}

async function submitReset(otpCode: string) {
  error.value = '';
  submitting.value = true;
  try {
    await auth.resetPassword({
      phone: phone.value,
      code: otpCode,
      newPassword: password.value,
    });
    router.push({ name: 'login', query: { phone: phone.value, reset: '1' } });
  } catch (e) {
    error.value = getErrorMessage(e);
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="flex items-center gap-2 mb-2">
      <KeyRound class="w-6 h-6 text-brand-600" />
      <h1 class="text-2xl font-semibold text-slate-900">Reset your password</h1>
    </div>
    <p class="text-sm text-slate-500 mb-6">
      We&apos;ll send a 6-digit code to your WhatsApp. Enter it below with your new password.
    </p>

    <div v-if="step === 'phone'" class="space-y-4">
      <PhoneInput v-model="phone" label="Phone number" required :error="error" />

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="button"
        :disabled="!phone || requesting"
        class="w-full h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        @click="onRequestCode"
      >
        <span>{{ requesting ? 'Sending code…' : 'Send reset code' }}</span>
        <ArrowRight v-if="!requesting" class="w-4 h-4" />
      </button>

      <p class="text-xs text-slate-500">
        If an account exists for this number, you&apos;ll receive a code on WhatsApp. We always show success here to protect your privacy.
      </p>
    </div>

    <form v-else class="space-y-4" @submit.prevent="onSubmit">
      <p class="text-sm text-slate-600">
        Code sent to <span class="font-medium text-slate-800">{{ phone }}</span>.
        <button type="button" class="text-brand-600 hover:underline ml-1" @click="step = 'phone'">Change number</button>
      </p>

      <OtpInput
        v-model="code"
        :error="error"
        :disabled="submitting"
        @complete="onComplete"
      />

      <PasswordInput v-model="password" label="New password" required autocomplete="new-password" />
      <ul class="text-xs text-slate-500 -mt-2 space-y-0.5">
        <li class="flex items-center gap-1">
          <Check v-if="password.length >= 8" class="w-3 h-3 text-brand-600" />
          <span :class="{ 'text-brand-600': password.length >= 8 }">At least 8 characters</span>
        </li>
        <li class="flex items-center gap-1">
          <Check v-if="/[A-Z]/.test(password)" class="w-3 h-3 text-brand-600" />
          <span :class="{ 'text-brand-600': /[A-Z]/.test(password) }">One uppercase letter</span>
        </li>
        <li class="flex items-center gap-1">
          <Check v-if="/\d/.test(password)" class="w-3 h-3 text-brand-600" />
          <span :class="{ 'text-brand-600': /\d/.test(password) }">One number</span>
        </li>
      </ul>

      <PasswordInput
        v-model="confirmPassword"
        label="Confirm new password"
        required
        :error="confirmPassword && password !== confirmPassword ? 'Passwords do not match' : ''"
        autocomplete="new-password"
      />

      <button
        type="submit"
        :disabled="!canReset"
        class="w-full h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <span>{{ submitting ? 'Updating…' : 'Set new password' }}</span>
        <ArrowRight v-if="!submitting" class="w-4 h-4" />
      </button>

      <div class="text-center">
        <button
          type="button"
          :disabled="resendCooldown > 0 || resending"
          class="text-sm text-brand-600 hover:underline disabled:text-slate-400 disabled:no-underline"
          @click="onResend"
        >
          {{ resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : resending ? 'Sending…' : 'Resend code' }}
        </button>
      </div>
    </form>

    <div class="mt-6 pt-6 border-t border-slate-200 text-center">
      <router-link to="/login" class="text-sm text-slate-500 hover:text-slate-700">← Back to sign in</router-link>
    </div>
  </AuthLayout>
</template>