<script setup lang="ts">
import { Download, BookOpen, ChevronDown } from 'lucide-vue-next';
import { ref } from 'vue';

const openSection = ref<string | null>('dashboard');

function toggle(id: string) {
  openSection.value = openSection.value === id ? null : id;
}

const sections = [
  {
    id: 'dashboard',
    title: 'Dashboard & menu',
    items: [
      'Dashboard card → My invoices: opens your subscription invoices.',
      'Dashboard card → My group: opens your savings group (or empty state).',
      'Dashboard card → Cycles / Reports: shortcuts when you have a group.',
      'Sidebar → My invoices, My group, User guide: same pages from any screen.',
      'Sign out → login screen. Moon/Sun icon → light or dark mode.',
    ],
  },
  {
    id: 'auth',
    title: 'Sign in & sign up',
    items: [
      'Send verification code → OTP screen (sign up).',
      '6 OTP digits → auto-submits; success lands on Dashboard.',
      'Resend code → new OTP; 60-second wait between sends.',
      'Sign in → Dashboard (or the page you tried to open first).',
      'Verify your phone → appears if phone not verified yet.',
    ],
  },
  {
    id: 'invoices',
    title: 'Invoices (pay & create group)',
    items: [
      'Tap an invoice row → payment details and upload area.',
      'Copy → copies pay-to account number; shows Copied briefly.',
      'browse / drag file → select JPG, PNG, or PDF proof (max 10 MB).',
      'Upload → “Uploaded! Our team will review…”; wait for admin approval.',
      'After approval → WhatsApp link opens Create group page.',
      'Create group → success screen → Sign in → your new group.',
    ],
  },
  {
    id: 'group',
    title: 'My group & members',
    items: [
      'Cycles / Reports / Loans → those sections for this group.',
      'Settings → owner only; contribution amount, WhatsApp, reminders.',
      'Overview tab → grace period, penalties, loan rules.',
      'Members tab → Add member (owner/treasurer); Remove (owner only).',
      'Add → saves new member; they get a WhatsApp invite.',
    ],
  },
  {
    id: 'settings',
    title: 'Group settings (owner)',
    items: [
      'Save changes → “✓ Settings saved.” or red error if invalid.',
      'Refresh groups → lists WhatsApp groups (add Chilimba number to chat first).',
      'Send verification code to group → 6-digit code posted in WhatsApp.',
      'Verify & link group → linked; announcements go to that chat.',
      'Disconnect → unlinks WhatsApp group.',
    ],
  },
  {
    id: 'cycles',
    title: 'Cycles — buttons',
    items: [
      'Open cycle (owner) → creates months and due dates.',
      'Start (owner) → collections begin; members notified.',
      'Complete (owner) → ends cycle early after confirm.',
      'Refresh → reloads latest contributions and payouts.',
      'Month tab → loads that month’s contributions and payouts.',
      'POP → upload payment screenshot (member, owner, treasurer).',
      'Record → mark paid in cash (owner/treasurer).',
      'Approve POP → approve uploaded proof (owner/treasurer).',
      'Waive → forgive contribution (owner only).',
      'Pick recipients → choose who gets paid this month (manual mode).',
      'Record payout → mark payout sent; optional receipt upload.',
    ],
  },
  {
    id: 'reports',
    title: 'Reports & loans',
    items: [
      'Cycle summary / Outstanding / Member statements / Loan book / Payout ledger → read-only tabs.',
      'Download PDF → payout ledger export (Payout ledger tab only).',
      'Request loan → pending until owner/treasurer Approves or Rejects.',
      'Record (loans) → log a repayment against an active loan.',
    ],
  },
  {
    id: 'stories',
    title: 'Quick user stories',
    items: [
      'New owner: Sign up → pay invoice → Upload POP → Create group → Settings → Open cycle → Start.',
      'Treasurer: Cycles → Approve POP or Record cash → Record payout when ready.',
      'Member: Cycles → POP on your row → check Reports → Member statements.',
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    items: [
      'Logged out? Sign in again — session saves on this device after login.',
      '“Not a member”? Dashboard → My group, not an old bookmark.',
      'No Settings button? Only the group owner can edit settings.',
      'Refresh groups empty? Add Chilimba number to WhatsApp group, wait, refresh.',
      'Record payout greyed out? Pick recipients and record contributions first.',
    ],
  },
];
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <div class="bg-gradient-to-br from-brand-50 to-warm-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-warm-100 dark:border-slate-700 p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-brand-100 dark:bg-emerald-900/50 text-brand-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
          <BookOpen class="w-6 h-6" />
        </div>
        <div class="flex-1">
          <h1 class="font-display text-2xl font-bold text-slate-900">User guide</h1>
          <p class="text-sm text-slate-600 mt-1">
            What each button does and what to expect — screen by screen. Download the full PDF for sharing.
          </p>
          <a
            href="/user-manual.pdf"
            download
            class="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            <Download class="w-4 h-4" />
            Download PDF manual
          </a>
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <div
        v-for="section in sections"
        :key="section.id"
        class="bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-warm-100 dark:border-slate-700 overflow-hidden"
      >
        <button
          class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-warm-50/50 dark:hover:bg-slate-800/80"
          @click="toggle(section.id)"
        >
          <span class="font-display font-semibold text-slate-900">{{ section.title }}</span>
          <ChevronDown
            class="w-5 h-5 text-slate-400 transition-transform"
            :class="openSection === section.id ? 'rotate-180' : ''"
          />
        </button>
        <ul v-if="openSection === section.id" class="px-5 pb-4 space-y-2 border-t border-warm-50 pt-3">
          <li v-for="(item, i) in section.items" :key="i" class="text-sm text-slate-600 flex gap-2">
            <span class="text-brand-500 shrink-0">•</span>
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>
    </div>

    <p class="text-xs text-slate-500 text-center">
      Share the PDF manual with members who prefer WhatsApp or print.
    </p>
  </div>
</template>