<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { getErrorCode, getErrorMessage } from '@/api/client';
import AuthLayout from '@/layouts/AuthLayout.vue';
import PhoneInput from '@/components/PhoneInput.vue';
import PasswordInput from '@/components/PasswordInput.vue';
import { ArrowRight, ShieldCheck, UserPlus } from 'lucide-vue-next';

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
              We sent a 6-digit code to your WhatsApp. Enter it to finish setting up your account.
            </p>
            <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                @click="goToVerify"
                class="inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:text-amber-700"
              >
                <ShieldCheck class="w-4 h-4" />
                Verify your phone →
              </button>
              <router-link
                :to="{ name: 'activate', query: phone ? { phone } : undefined }"
                class="inline-flex items-center gap-1.5 text-sm font-medium text-amber-900 hover:text-amber-700"
              >
                Added by your admin? Set password →
              </router-link>
            </div>
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

    <div class="mt-6 pt-6 border-t border-slate-200">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div class="flex items-start gap-3">
          <UserPlus class="w-5 h-5 text-brand-600 mt-0.5 flex-shrink-0" />
          <div class="flex-1">
            <p class="text-sm font-medium text-slate-900">Added to a group by your admin?</p>
            <p class="text-xs text-slate-600 mt-1">
              Verify your WhatsApp number and set a password to access your group.
            </p>
            <router-link
              :to="{ name: 'activate', query: phone ? { phone } : undefined }"
              class="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Verify number &amp; set password →
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </AuthLayout>
</template>
