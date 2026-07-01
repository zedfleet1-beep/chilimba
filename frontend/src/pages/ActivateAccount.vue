<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getErrorCode, getErrorMessage } from '@/api/client';
import AuthLayout from '@/layouts/AuthLayout.vue';
import PhoneInput from '@/components/PhoneInput.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import OtpInput from '@/components/OtpInput.vue';
import { ArrowRight, Check, ShieldCheck } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const step = ref<'phone' | 'verify'>('phone');
const phone = ref('');
const code = ref('');
const password = ref('');
const confirmPassword = ref('');
const consent = ref(false);

const error = ref('');
const errorCode = ref('');
const requesting = ref(false);
const submitting = ref(false);
const resending = ref(false);
const resendCooldown = ref(0);

let cooldownTimer: number | undefined;

const passwordValid = computed(
  () => password.value.length >= 8 && /[A-Z]/.test(password.value) && /\d/.test(password.value),
);

const canComplete = computed(
  () =>
    code.value.length === 6 &&
    passwordValid.value &&
    password.value === confirmPassword.value &&
    consent.value &&
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
  errorCode.value = '';
  requesting.value = true;
  try {
    await auth.requestActivationOtp(phone.value);
    step.value = 'verify';
    startCooldown();
  } catch (e) {
    error.value = getErrorMessage(e);
    errorCode.value = getErrorCode(e);
  } finally {
    requesting.value = false;
  }
}

async function onResend() {
  if (resendCooldown.value > 0) return;
  resending.value = true;
  error.value = '';
  try {
    await auth.requestActivationOtp(phone.value);
    startCooldown();
  } catch (e) {
    error.value = getErrorMessage(e, 'Could not resend code. Please try again.');
  } finally {
    resending.value = false;
  }
}

async function onComplete(value: string) {
  code.value = value;
  if (!canComplete.value) return;
  error.value = '';
  submitting.value = true;
  try {
    await auth.completeActivation({
      phone: phone.value,
      code: value,
      password: password.value,
      consent: true,
    });
    router.push({ name: 'dashboard' });
  } catch (e) {
    error.value = getErrorMessage(e);
    errorCode.value = getErrorCode(e);
    submitting.value = false;
  }
}

async function onSubmit() {
  if (code.value.length !== 6) return;
  await onComplete(code.value);
}
</script>

<template>
  <AuthLayout>
    <div class="flex items-center gap-2 mb-2">
      <ShieldCheck class="w-6 h-6 text-brand-600" />
      <h1 class="text-2xl font-semibold text-slate-900">Set up your account</h1>
    </div>
    <p class="text-sm text-slate-500 mb-6">
      Your group admin added you to Chilimba. Verify your WhatsApp number and choose a password to sign in.
    </p>

    <div v-if="step === 'phone'" class="space-y-4">
      <PhoneInput v-model="phone" label="Phone number" required :error="error" />

      <p v-if="errorCode === 'ALREADY_ACTIVATED'" class="text-sm text-slate-600">
        <router-link to="/login" class="text-brand-600 hover:underline">Sign in instead →</router-link>
      </p>
      <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

      <button
        type="button"
        :disabled="!phone || requesting"
        class="w-full h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        @click="onRequestCode"
      >
        <span>{{ requesting ? 'Sending code…' : 'Send verification code' }}</span>
        <ArrowRight v-if="!requesting" class="w-4 h-4" />
      </button>
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

      <PasswordInput v-model="password" label="Create password" required autocomplete="new-password" />
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
        label="Confirm password"
        required
        :error="confirmPassword && password !== confirmPassword ? 'Passwords do not match' : ''"
        autocomplete="new-password"
      />

      <label class="flex items-start gap-2 text-sm text-slate-600">
        <input
          v-model="consent"
          type="checkbox"
          class="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>I agree to receive WhatsApp messages from Chilimba about my account and groups.</span>
      </label>

      <p v-if="errorCode === 'ALREADY_ACTIVATED'" class="text-sm text-slate-600">
        <router-link to="/login" class="text-brand-600 hover:underline">Sign in instead →</router-link>
      </p>

      <button
        type="submit"
        :disabled="!canComplete"
        class="w-full h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <span>{{ submitting ? 'Activating…' : 'Activate account' }}</span>
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