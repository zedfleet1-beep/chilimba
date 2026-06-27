import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'chilimba_theme';

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>('light');
  const ready = ref(false);

  function apply() {
    const isDark = mode.value === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('app-light', !isDark);
  }

  function init() {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark') {
      mode.value = saved;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      mode.value = 'dark';
    }
    apply();
    ready.value = true;
  }

  function setMode(next: ThemeMode) {
    mode.value = next;
    localStorage.setItem(STORAGE_KEY, next);
    apply();
  }

  function toggle() {
    setMode(mode.value === 'dark' ? 'light' : 'dark');
  }

  watch(mode, apply);

  return { mode, ready, init, setMode, toggle };
});