<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';

defineProps<{
  modelValue: string;
  label?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  autocomplete?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const show = ref(false);

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div>
    <label v-if="label" class="block text-sm font-medium text-slate-700 mb-1">
      {{ label }}<span v-if="required" class="text-red-500">*</span>
    </label>
    <div class="relative">
      <input
        :value="modelValue"
        @input="onInput"
        :type="show ? 'text' : 'password'"
        :placeholder="placeholder"
        :autocomplete="autocomplete || 'current-password'"
        class="w-full h-11 px-3 pr-10 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        :class="{ 'border-red-500': !!error }"
      />
      <button
        type="button"
        @click="show = !show"
        class="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-600"
      >
        <Eye v-if="!show" class="w-4 h-4" />
        <EyeOff v-else class="w-4 h-4" />
      </button>
    </div>
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
  </div>
</template>
