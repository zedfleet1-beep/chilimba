<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  modelValue: string;
  label?: string;
  placeholder?: string;
  defaultCountryCode?: string;
  error?: string;
  required?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const countryCode = ref(props.defaultCountryCode || '+260');
const localNumber = ref(props.modelValue?.replace(/^\+\d+/, '') || '');

const fullNumber = computed(() => `${countryCode.value}${localNumber.value.replace(/^0+/, '')}`);

function onLocalInput(e: Event) {
  const v = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
  localNumber.value = v;
  emit('update:modelValue', fullNumber.value);
}

function onCountryChange(e: Event) {
  countryCode.value = (e.target as HTMLSelectElement).value;
  emit('update:modelValue', fullNumber.value);
}
</script>

<template>
  <div>
    <label v-if="label" class="block text-sm font-medium text-slate-700 mb-1">
      {{ label }}<span v-if="required" class="text-red-500">*</span>
    </label>
    <div class="flex gap-2">
      <select
        :value="countryCode"
        @change="onCountryChange"
        class="h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      >
        <option value="+260">+260 ZM</option>
        <option value="+263">+263 ZW</option>
        <option value="+27">+27 ZA</option>
        <option value="+254">+254 KE</option>
        <option value="+255">+255 TZ</option>
        <option value="+256">+256 UG</option>
        <option value="+234">+234 NG</option>
        <option value="+233">+233 GH</option>
      </select>
      <input
        :value="localNumber"
        @input="onLocalInput"
        type="tel"
        inputmode="numeric"
        :placeholder="placeholder || '97 712 3456'"
        class="flex-1 h-11 px-3 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        :class="{ 'border-red-500': !!error }"
      />
    </div>
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
  </div>
</template>
