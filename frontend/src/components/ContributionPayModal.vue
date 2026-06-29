<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CheckCircle2, FileUp, UploadCloud, X } from 'lucide-vue-next';
import PaymentDetailsCard from '@/components/PaymentDetailsCard.vue';
import { getContributionDefault } from '@/api/paymentSettings';
import { formatNgwe } from '@/lib/money';
import { getErrorMessage } from '@/api/client';
import type { PaymentDetails } from '@/lib/payment';

const props = defineProps<{
  open: boolean;
  groupId: string;
  groupName: string;
  amountNgwe: string;
  roundLabel: string;
  dueDate: string;
  status: string;
  proofUrl: string | null;
  uploading: boolean;
}>();

const emit = defineEmits<{
  close: [];
  upload: [file: File];
}>();

const paymentDetails = ref<PaymentDetails | null>(null);
const paymentLoading = ref(false);
const paymentError = ref('');
const pickedFile = ref<File | null>(null);
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const isDone = computed(() => ['paid', 'late', 'waived'].includes(props.status));
const awaitingApproval = computed(() => props.status === 'pending' && !!props.proofUrl);
const canUpload = computed(() => props.status === 'pending' && !props.proofUrl);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      pickedFile.value = null;
      paymentError.value = '';
      return;
    }
    paymentLoading.value = true;
    paymentError.value = '';
    try {
      paymentDetails.value = await getContributionDefault(props.groupId);
    } catch (e) {
      paymentError.value = getErrorMessage(e, 'Could not load payment details');
    } finally {
      paymentLoading.value = false;
    }
  },
);

function setPicked(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
    paymentError.value = 'Please upload a JPG, PNG, or PDF file.';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    paymentError.value = 'File is too large. Max 10 MB.';
    return;
  }
  pickedFile.value = file;
  paymentError.value = '';
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) setPicked(file);
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) setPicked(file);
}

function onSubmit() {
  if (!pickedFile.value) return;
  emit('upload', pickedFile.value);
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-xl border border-warm-100 w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div class="sticky top-0 bg-white border-b border-warm-50 px-5 py-4 flex items-center justify-between">
        <div>
          <h3 class="font-display text-lg font-semibold text-slate-900">Make contribution</h3>
          <p class="text-sm text-slate-500">{{ groupName }} · {{ roundLabel }}</p>
        </div>
        <button
          class="p-2 rounded-lg text-slate-500 hover:bg-warm-50"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-5 space-y-5">
        <div class="rounded-xl bg-brand-50 border border-brand-100 p-4">
          <p class="text-xs uppercase tracking-wide text-brand-700">Amount due</p>
          <p class="font-display text-3xl font-bold text-slate-900 mt-1">{{ formatNgwe(amountNgwe) }}</p>
          <p class="text-sm text-slate-600 mt-1">Due {{ new Date(dueDate).toLocaleDateString() }}</p>
          <span
            class="inline-flex mt-3 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
            :class="{
              'bg-emerald-100 text-emerald-800': isDone,
              'bg-warm-100 text-warm-700': status === 'pending' && !proofUrl,
              'bg-sky-100 text-sky-800': awaitingApproval,
            }"
          >
            {{ status }}
          </span>
        </div>

        <div v-if="isDone" class="text-center py-4">
          <CheckCircle2 class="w-12 h-12 mx-auto text-brand-600 mb-2" />
          <p class="font-medium text-slate-800">Contribution recorded</p>
          <p class="text-sm text-slate-500 mt-1">Nothing more to do for this month.</p>
        </div>

        <template v-else>
          <div v-if="paymentLoading" class="text-sm text-slate-500">Loading payment details…</div>
          <PaymentDetailsCard
            v-else
            :details="paymentDetails"
            heading="Send contribution to"
          />

          <p v-if="paymentError" class="text-sm text-red-600">{{ paymentError }}</p>

          <div v-if="awaitingApproval" class="rounded-xl bg-sky-50 border border-sky-100 p-4 text-sm text-sky-900">
            <p class="font-medium">Proof uploaded</p>
            <p class="mt-1 text-sky-800/90">Your treasurer or group owner will review and confirm shortly.</p>
            <a
              v-if="proofUrl"
              :href="proofUrl"
              target="_blank"
              rel="noopener"
              class="inline-block mt-2 text-brand-700 font-medium hover:underline"
            >
              View uploaded file
            </a>
          </div>

          <div v-else-if="canUpload" class="space-y-3">
            <p class="text-sm font-medium text-slate-800">Upload proof of payment</p>
            <div
              class="border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer"
              :class="dragOver ? 'border-brand-500 bg-brand-50' : 'border-warm-200 bg-warm-50/40'"
              @dragover.prevent="dragOver = true"
              @dragleave="dragOver = false"
              @drop="onDrop"
              @click="fileInput?.click()"
            >
              <UploadCloud class="w-10 h-10 mx-auto text-warm-500 mb-2" />
              <p v-if="!pickedFile" class="text-sm text-slate-600">
                Drag &amp; drop or <span class="text-brand-600 font-medium">browse</span>
              </p>
              <p v-else class="text-sm text-slate-800 font-medium">{{ pickedFile.name }}</p>
              <p class="text-xs text-slate-500 mt-1">JPG, PNG, or PDF up to 10 MB</p>
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                class="hidden"
                @change="onFileInput"
              />
            </div>

            <button
              class="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50"
              :disabled="!pickedFile || uploading"
              @click="onSubmit"
            >
              <FileUp class="w-4 h-4" />
              {{ uploading ? 'Uploading…' : 'Submit proof' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>