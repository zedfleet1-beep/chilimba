<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getErrorCode, getErrorMessage } from '@/api/client';
import AuthLayout from '@/layouts/AuthLayout.vue';
import PhoneInput from '@/components/PhoneInput.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import { ArrowRight, ShieldCheck } from 'lucide-vue-next';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const phone = ref('');
const password = ref('');
const submitError = ref('');
const errorCode = ref('');
const submitting = ref(false);

const needsVerification = computed(() => errorCode.value === 'OTP_NOT_VERIFIED');

async function onSubmit() {
  submitError.value = '';
  errorCode.value = '';
  submitting.value = true;
  try {
    await auth.login(phone.value, password.value);
    const next = typeof route.query.next === 'string' ? route.query.next : null;
    router.push(next && next.startsWith('/') ? next : { name: 'dashboard' });
  } catch (e) {
    submitError.value = getErrorMessage(e);
    errorCode.value = getErrorCode(e);
  } finally {
    submitting.value = false;
  }
}

function goToVerify() {
  router.push({ name: 'otp', query: { phone: phone.value } });
}
</script>

<template>
  <AuthLayout>
    <h1 class="text-2xl font-semibold text-slate-900 mb-2">Welcome back</h1>
    <p class="text-sm text-slate-500 mb-6">Sign in to your Chilimba account.</p>

    <form @submit.prevent="onSubmit" class="space-y-4">
      <PhoneInput v-model="phone" label="Phone number" required />
      <PasswordInput v-model="password" label="Password" required autocomplete="current-password" />

      <p v-if="submitError && !needsVerification" class="text-sm text-red-600">{{ submitError }}</p>

      <div
        v-if="needsVerification"
        class="rounded-lg border border-amber-200 bg-amber-50 p-4"
      >
        <div class="flex items-start gap-3">
          <ShieldCheck class="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div class="flex-1">
            <p class="text-sm font-medium text-amber-900">Phone not verified yet</p>
            <p class="text-xs text-amber-800 mt-1">
              We sent a 6-digit code to your WhatsApp when you signed up. Enter it to finish setting up your account.
            </p>
            <button
              type="button"
              @click="goToVerify"
              class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:text-amber-700"
            >
              <ShieldCheck class="w-4 h-4" />
              Verify your phone →
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        :disabled="!phone || !password || submitting"
        class="w-full h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <span>{{ submitting ? 'Signing in…' : 'Sign in' }}</span>
        <ArrowRight v-if="!submitting" class="w-4 h-4" />
      </button>

      <p class="text-center text-sm text-slate-500">
        Don&apos;t have an account?
        <router-link to="/signup" class="text-brand-600 hover:underline">Create one</router-link>
      </p>
    </form>
  </AuthLayout>
</template>
