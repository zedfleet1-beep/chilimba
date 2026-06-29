<script setup lang="ts">
import { computed } from 'vue';
import { Check, ExternalLink, FileText, X } from 'lucide-vue-next';
import { formatNgwe } from '@/lib/money';

const props = defineProps<{
  open: boolean;
  memberName: string;
  amountNgwe: string;
  status: string;
  proofUrl: string;
  fileType?: string | null;
  canApprove?: boolean;
  approving?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  approve: [];
}>();

const isImage = computed(() => {
  if (props.fileType === 'jpg' || props.fileType === 'png') return true;
  return /\.(jpe?g|png|webp)(\?|$)/i.test(props.proofUrl);
});

const isPdf = computed(() => {
  if (props.fileType === 'pdf') return true;
  return /\.pdf(\?|$)/i.test(props.proofUrl);
});

const showApprove = computed(
  () => props.canApprove && props.status === 'pending' && !!props.proofUrl,
);
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-xl border border-warm-100 w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div class="shrink-0 border-b border-warm-50 px-5 py-4 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-display text-lg font-semibold text-slate-900">Review proof of payment</h3>
          <p class="text-sm text-slate-500 truncate">
            {{ memberName }} · {{ formatNgwe(amountNgwe) }} ·
            <span class="capitalize">{{ status }}</span>
          </p>
        </div>
        <button
          class="p-2 rounded-lg text-slate-500 hover:bg-warm-50 shrink-0"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-5">
        <div
          v-if="isImage"
          class="rounded-xl border border-warm-100 bg-warm-50/40 overflow-hidden"
        >
          <img
            :src="proofUrl"
            :alt="`Proof of payment from ${memberName}`"
            class="w-full max-h-[55vh] object-contain bg-white"
          />
        </div>

        <div
          v-else-if="isPdf"
          class="rounded-xl border border-warm-100 overflow-hidden bg-warm-50/40"
        >
          <iframe
            :src="proofUrl"
            title="Proof of payment PDF"
            class="w-full h-[55vh] bg-white"
          />
          <p class="px-4 py-2 text-xs text-slate-500 border-t border-warm-100">
            If the PDF does not display, open it in a new tab below.
          </p>
        </div>

        <div
          v-else
          class="rounded-xl border border-warm-100 bg-warm-50/40 p-8 text-center"
        >
          <FileText class="w-12 h-12 mx-auto text-warm-500 mb-3" />
          <p class="text-sm text-slate-600">Preview not available for this file type.</p>
        </div>
      </div>

      <div class="shrink-0 border-t border-warm-50 px-5 py-4 flex flex-wrap gap-2 justify-end">
        <a
          :href="proofUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-warm-50"
        >
          <ExternalLink class="w-4 h-4" />
          Open in new tab
        </a>
        <button
          class="h-10 px-4 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-warm-50"
          @click="emit('close')"
        >
          Close
        </button>
        <button
          v-if="showApprove"
          class="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          :disabled="approving"
          @click="emit('approve')"
        >
          <Check class="w-4 h-4" />
          {{ approving ? 'Approving…' : 'Approve POP' }}
        </button>
      </div>
    </div>
  </div>
</template>