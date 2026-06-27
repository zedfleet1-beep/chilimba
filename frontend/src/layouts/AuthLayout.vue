<script setup lang="ts">
import { Coins, Moon, Sun } from 'lucide-vue-next';
import { useThemeStore } from '@/stores/theme';

const theme = useThemeStore();
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12 transition-colors">
    <button
      type="button"
      class="fixed top-4 right-4 p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800"
      :aria-label="theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="theme.toggle()"
    >
      <Sun v-if="theme.mode === 'dark'" class="w-5 h-5" />
      <Moon v-else class="w-5 h-5" />
    </button>
    <div class="w-full max-w-md">
      <div class="flex items-center justify-center mb-8">
        <div class="flex items-center gap-2 text-brand-600 dark:text-emerald-400">
          <Coins class="w-8 h-8" />
          <span class="text-2xl font-bold">Chilimba</span>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <slot />
      </div>
    </div>
  </div>
</template>
