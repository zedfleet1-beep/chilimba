<script setup lang="ts">
import AuthLayout from '@/layouts/AuthLayout.vue';
import { useRouter } from 'vue-router';
const router = useRouter();
</script>

<template>
  <AuthLayout>
    <h1 class="text-2xl font-semibold text-slate-900 mb-2">Page not found</h1>
    <p class="text-sm text-slate-500 mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
    <button
      @click="router.push('/')"
      class="w-full h-11 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700"
    >
      Go home
    </button>
  </AuthLayout>
</template>
