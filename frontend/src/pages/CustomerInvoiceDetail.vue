<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInvoicesStore } from '@/stores/invoices';
import { formatNgwe } from '@/lib/money';
import { ArrowLeft, UploadCloud, CheckCircle2 } from 'lucide-vue-next';
import PaymentDetailsCard from '@/components/PaymentDetailsCard.vue';

const route = useRoute();
const router = useRouter();
const store = useInvoicesStore();
const id = computed(() => String(route.params.id));

const fileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);
const pickedFile = ref<File | null>(null);
const success = ref(false);

onMounted(() => store.fetchOne(id.value));

const invoice = computed(() => store.current);
const pop = computed(() => {
  const list = invoice.value?.paymentProofs ?? [];
  return list[0] ?? null;
});

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) setPicked(f);
}
function onDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) setPicked(f);
}
function setPicked(f: File) {
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
    store.error = 'Please upload a JPG, PNG, or PDF file.';
    return;
  }
  if (f.size > 10 * 1024 * 1024) {
    store.error = 'File is too large. Max 10 MB.';
    return;
  }
  pickedFile.value = f;
  store.error = null;
}

async function onUpload() {
  if (!pickedFile.value) return;
  const result = await store.uploadPop(id.value, pickedFile.value);
  if (result) {
    success.value = true;
    pickedFile.value = null;
  }
}
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <button
      class="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      @click="router.push({ name: 'customer-invoices' })"
    >
      <ArrowLeft class="w-4 h-4" />
      All my invoices
    </button>

    <div v-if="!invoice && store.loading" class="text-slate-500">Loading…</div>

    <div v-else-if="invoice" class="space-y-6">
      <div class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6">
        <p class="font-mono text-sm text-slate-500">{{ invoice.invoiceNumber }}</p>
        <p class="font-display text-3xl font-bold text-slate-900 mt-1">{{ formatNgwe(invoice.amountNgwe) }}</p>
        <p class="text-sm text-slate-600 mt-2">{{ invoice.description ?? '—' }}</p>
        <div class="mt-3">
          <span
            class="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
            :class="{
              'bg-warm-100 text-warm-600': invoice.status === 'pending',
              'bg-brand-50 text-brand-700': invoice.status === 'paid',
              'bg-slate-100 text-slate-500': invoice.status === 'cancelled',
            }"
          >
            {{ invoice.status }}
          </span>
        </div>
      </div>

      <!-- Pay to card: only while the invoice is unpaid -->
      <PaymentDetailsCard
        v-if="invoice.status === 'pending'"
        :details="invoice.paymentDetails ?? null"
        heading="Pay to"
        :show-source="true"
      />

      <!-- POP upload -->
      <div v-if="invoice.status === 'pending'" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6">
        <h3 class="font-display text-lg font-semibold text-slate-900 mb-1">Upload proof of payment</h3>
        <p class="text-sm text-slate-500 mb-4">JPG, PNG, or PDF up to 10 MB.</p>

        <div
          class="border-2 border-dashed rounded-xl p-8 text-center transition-colors"
          :class="dragOver ? 'border-brand-500 bg-brand-50' : 'border-warm-200 bg-warm-50/40'"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop="onDrop"
        >
          <UploadCloud class="w-10 h-10 mx-auto text-warm-500 mb-2" />
          <p v-if="!pickedFile" class="text-sm text-slate-600">
            Drag &amp; drop or
            <button class="text-brand-600 hover:underline" @click="fileInput?.click()">browse</button>
          </p>
          <p v-else class="text-sm text-slate-700 font-medium">
            {{ pickedFile.name }} <span class="text-slate-500">({{ (pickedFile.size / 1024).toFixed(0) }} KB)</span>
          </p>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            class="hidden"
            @change="onFile"
          />
        </div>

        <p v-if="store.error" class="text-sm text-red-600 mt-3">{{ store.error }}</p>
        <p v-if="success" class="text-sm text-brand-700 mt-3 inline-flex items-center gap-1.5">
          <CheckCircle2 class="w-4 h-4" />
          Uploaded! Our team will review and confirm shortly.
        </p>

        <div class="flex justify-end mt-4">
          <button
            :disabled="!pickedFile || store.uploading"
            class="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50"
            @click="onUpload"
          >
            <UploadCloud class="w-4 h-4" />
            {{ store.uploading ? 'Uploading…' : 'Upload' }}
          </button>
        </div>
      </div>

      <!-- POP history -->
      <div v-if="pop" class="bg-white rounded-2xl shadow-soft border border-warm-100 p-6">
        <h3 class="font-display text-lg font-semibold text-slate-900 mb-2">Your submission</h3>
        <div class="text-sm text-slate-700">
          <p class="font-mono text-xs text-slate-500">{{ pop.fileKey }}</p>
          <p class="mt-1">
            Status:
            <span
              class="px-2 py-0.5 rounded-full text-xs font-medium"
              :class="{
                'bg-warm-100 text-warm-600': pop.status === 'pending',
                'bg-brand-50 text-brand-700': pop.status === 'approved',
                'bg-coral-500/10 text-coral-600': pop.status === 'rejected',
              }"
            >
              {{ pop.status }}
            </span>
          </p>
          <p v-if="pop.notes" class="mt-2 text-slate-600">Admin note: {{ pop.notes }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
