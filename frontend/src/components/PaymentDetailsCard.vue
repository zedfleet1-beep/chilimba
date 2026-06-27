<script setup lang="ts">
import { ref, computed } from 'vue';
import { Copy, Check, Info } from 'lucide-vue-next';
import { displayFor, type PaymentDetails } from '@/lib/payment';

const props = defineProps<{
  details: PaymentDetails | null;
  /** Heading: "Pay to" (default) or "Send contributions to" (for groups). */
  heading?: string;
  /** Tiny label shown next to the heading ("Override" or "Platform default"). */
  showSource?: boolean;
}>();

const copied = ref(false);
const display = computed(() => (props.details ? displayFor(props.details) : null));

async function copy() {
  if (!props.details) return;
  try {
    await navigator.clipboard.writeText(props.details.accountNumber);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1800);
  } catch {
    /* clipboard may be unavailable */
  }
}
</script>

<template>
  <div class="bg-gradient-to-br from-warm-50 to-cream-100 rounded-2xl shadow-soft border border-warm-200 p-6">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-display text-lg font-semibold text-slate-900">
        {{ heading ?? 'Pay to' }}
      </h3>
      <span
        v-if="showSource && details"
        class="text-xs px-2 py-0.5 rounded-full font-medium"
        :class="details.isOverride ? 'bg-sky-100 text-sky-700' : 'bg-warm-200 text-warm-700'"
      >
        {{ details.isOverride ? 'Invoice override' : 'Platform default' }}
      </span>
    </div>

    <div v-if="!details" class="flex items-start gap-2 text-sm text-slate-600">
      <Info class="w-4 h-4 text-warm-600 mt-0.5 shrink-0" />
      <p>Payment details haven't been set yet. Please contact us to confirm where to send your payment.</p>
    </div>

    <div v-else class="space-y-3">
      <span
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        :class="display!.badgeClass"
      >
        <component :is="display!.icon" class="w-3.5 h-3.5" />
        {{ display!.badgeText }}
      </span>

      <div class="flex items-start gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-500">{{ display!.accountLine }}</p>
          <p class="font-mono text-xl font-semibold text-slate-900 break-all">
            {{ details.accountNumber }}
          </p>
          <p v-if="details.reference" class="text-xs text-slate-500 mt-2">
            <span class="font-medium text-slate-600">Reference:</span> {{ details.reference }}
          </p>
        </div>
        <button
          class="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-white border border-warm-200 text-slate-700 text-xs font-medium hover:bg-warm-50 hover:border-warm-300 shrink-0"
          @click="copy"
        >
          <Check v-if="copied" class="w-3.5 h-3.5 text-brand-600" />
          <Copy v-else class="w-3.5 h-3.5" />
          {{ copied ? 'Copied' : 'Copy' }}
        </button>
      </div>
    </div>
  </div>
</template>
