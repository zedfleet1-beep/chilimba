<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/api/client';
import AuthLayout from '@/layouts/AuthLayout.vue';
import PhoneInput from '@/components/PhoneInput.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import { ArrowRight, Check } from 'lucide-vue-next';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

onMounted(() => {
  const invitedPhone = route.query.phone;
  if (typeof invitedPhone === 'string' && invitedPhone.trim()) {
    router.replace({ name: 'activate', query: { phone: invitedPhone } });
  }
});

const firstName = ref('');
const lastName = ref('');
const phone = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const consent = ref(false);

const errors = ref<Record<string, string>>({});
const submitting = ref(false);
const submitError = ref('');

const passwordValid = computed(
  () => password.value.length >= 8 && /[A-Z]/.test(password.value) && /\d/.test(password.value),
);

const canSubmit = computed(
  () =>
    !!firstName.value &&
    !!lastName.value &&
    !!phone.value &&
    !!password.value &&
    password.value === confirmPassword.value &&
    consent.value &&
    passwordValid.value &&
    !submitting.value,
);

async function onSubmit() {
  errors.value = {};
  submitError.value = '';
  if (!passwordValid.value) {
    errors.value.password = 'Password must be 8+ chars, include 1 uppercase and 1 number';
    return;
  }
  if (password.value !== confirmPassword.value) {
    errors.value.confirmPassword = 'Passwords do not match';
    return;
  }
  submitting.value = true;
  try {
    await auth.signup({
      firstName: firstName.value,
      lastName: lastName.value,
      phone: phone.value,
      email: email.value || undefined,
      password: password.value,
      consent: true,
    });
    router.push({ name: 'otp', query: { phone: phone.value } });
  } catch (e) {
    submitError.value = getErrorMessage(e);
    if (submitError.value.toLowerCase().includes('phone')) {
      errors.value.phone = submitError.value;
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <h1 class="text-2xl font-semibold text-slate-900 mb-2">Create your account</h1>
    <p class="text-sm text-slate-500 mb-6">We&apos;ll send a verification code to your WhatsApp.</p>

    <form @submit.prevent="onSubmit" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">First name<span class="text-red-500">*</span></label>
          <input
            v-model="firstName"
            type="text"
            required
            class="w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Last name<span class="text-red-500">*</span></label>
          <input
            v-model="lastName"
            type="text"
            required
            class="w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
        </div>
      </div>

      <PhoneInput v-model="phone" label="Phone number" required :error="errors.phone" />
      <p class="text-xs text-slate-500 -mt-2">Default country: Zambia (+260)</p>

      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Email <span class="text-slate-400 font-normal">(optional)</span></label>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          class="w-full h-11 px-3 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        />
      </div>

      <PasswordInput v-model="password" label="Password" required :error="errors.password" autocomplete="new-password" />
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

      <PasswordInput v-model="confirmPassword" label="Confirm password" required :error="errors.confirmPassword" autocomplete="new-password" />

      <label class="flex items-start gap-2 text-sm text-slate-600">
        <input
          v-model="consent"
          type="checkbox"
          class="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>I agree to receive WhatsApp messages from Chilimba about my account and groups.</span>
      </label>

      <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

      <button
        type="submit"
        :disabled="!canSubmit"
        class="w-full h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <span>{{ submitting ? 'Sending code…' : 'Send verification code' }}</span>
        <ArrowRight v-if="!submitting" class="w-4 h-4" />
      </button>

      <p class="text-center text-sm text-slate-500">
        Already have an account?
        <router-link to="/login" class="text-brand-600 hover:underline">Sign in</router-link>
      </p>
    </form>
  </AuthLayout>
</template>
