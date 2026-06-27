<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
  length?: number;
  modelValue?: string;
  error?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'complete', value: string): void;
}>();

const len = props.length ?? 6;
const digits = ref<string[]>(Array(len).fill(''));
const inputs = ref<HTMLInputElement[]>([]);

function setRef(el: Element | null, idx: number) {
  if (el instanceof HTMLInputElement) inputs.value[idx] = el;
}

function onInput(idx: number, e: Event) {
  const v = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '').slice(-1);
  digits.value[idx] = v;
  emit('update:modelValue', digits.value.join(''));
  if (v && idx < len - 1) {
    inputs.value[idx + 1]?.focus();
  }
  if (digits.value.every((d) => d !== '')) {
    emit('complete', digits.value.join(''));
  }
}

function onKeyDown(idx: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !digits.value[idx] && idx > 0) {
    inputs.value[idx - 1]?.focus();
  }
}

function onPaste(e: ClipboardEvent) {
  const data = e.clipboardData?.getData('text') ?? '';
  const cleaned = data.replace(/[^0-9]/g, '').slice(0, len);
  if (cleaned) {
    for (let i = 0; i < len; i++) digits.value[i] = cleaned[i] || '';
    emit('update:modelValue', digits.value.join(''));
    if (digits.value.every((d) => d !== '')) {
      emit('complete', digits.value.join(''));
    }
    inputs.value[len - 1]?.focus();
    e.preventDefault();
  }
}

onMounted(() => {
  inputs.value[0]?.focus();
});
</script>

<template>
  <div>
    <div class="flex gap-2 justify-center" @paste="onPaste">
      <input
        v-for="i in len"
        :key="i"
        :ref="(el) => setRef(el as Element | null, i - 1)"
        :value="digits[i - 1]"
        @input="(e) => onInput(i - 1, e as InputEvent)"
        @keydown="(e) => onKeyDown(i - 1, e)"
        type="text"
        inputmode="numeric"
        maxlength="1"
        :disabled="disabled"
        class="w-12 h-14 text-center text-2xl font-semibold rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        :class="{ 'border-red-500': !!error }"
      />
    </div>
    <p v-if="error" class="mt-2 text-center text-xs text-red-600">{{ error }}</p>
  </div>
</template>
