<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import {
  Coins,
  LayoutDashboard,
  Receipt,
  Users,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  CreditCard,
  BarChart3,
  MessageSquare,
  BookOpen,
  Moon,
  Sun,
} from 'lucide-vue-next';
import { ref } from 'vue';

const auth = useAuthStore();
const theme = useThemeStore();
const router = useRouter();
const route = useRoute();

const sidebarOpen = ref(false);
const isSuperAdmin = computed(() => auth.user?.role === 'super_admin');

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'My invoices', icon: Receipt, adminOnly: true },
  { to: '/groups', label: 'My group', icon: Users },
  { to: '/help', label: 'User guide', icon: BookOpen },
  { to: '/admin', label: 'Admin', icon: BarChart3, adminOnly: true },
  { to: '/admin/invoices', label: 'All invoices', icon: ShieldCheck, adminOnly: true },
  { to: '/admin/payment-settings', label: 'Payment settings', icon: CreditCard, adminOnly: true },
  { to: '/admin/groups', label: 'All groups', icon: Users, adminOnly: true },
  { to: '/admin/users', label: 'All users', icon: Users, adminOnly: true },
  { to: '/admin/whatsapp-logs', label: 'WhatsApp logs', icon: MessageSquare, adminOnly: true },
];

const visibleNav = computed(() => navItems.filter((n) => !n.adminOnly || isSuperAdmin.value));

const pageTitle = computed(() => {
  if (route.meta.title) return String(route.meta.title);
  const current = visibleNav.value.find((n) => route.path.startsWith(n.to));
  return current?.label ?? 'Chilimba';
});

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`);
}

async function onLogout() {
  await auth.logout();
  router.push({ name: 'login' });
}


</script>

<template>
  <div class="min-h-screen flex bg-cream-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-30 w-64 bg-white/80 dark:bg-slate-900/95 backdrop-blur border-r border-warm-100 dark:border-slate-700 transform transition-transform md:translate-x-0 md:static md:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="h-16 flex items-center gap-2 px-6 border-b border-warm-100 dark:border-slate-700">
        <Coins class="w-7 h-7 text-brand-600 dark:text-emerald-400" />
        <span class="font-display text-xl font-bold text-slate-900 dark:text-slate-100">Chilimba</span>
      </div>
      <nav class="p-3 space-y-1">
        <router-link
          v-for="item in visibleNav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-warm-100 dark:bg-slate-800 text-warm-600 dark:text-emerald-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-warm-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
          "
          @click="sidebarOpen = false"
        >
          <component :is="item.icon" class="w-4 h-4" />
          {{ item.label }}
        </router-link>
      </nav>
    </aside>

    <!-- Backdrop (mobile only) -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-slate-900/30 z-20 md:hidden"
      @click="sidebarOpen = false"
    />

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-16 flex items-center justify-between px-4 md:px-8 bg-white/70 dark:bg-slate-900/80 backdrop-blur border-b border-warm-100 dark:border-slate-700">
        <div class="flex items-center gap-3">
          <button
            class="md:hidden p-1.5 rounded-lg hover:bg-warm-50 text-slate-600"
            @click="sidebarOpen = !sidebarOpen"
            aria-label="Toggle menu"
          >
            <X v-if="sidebarOpen" class="w-5 h-5" />
            <Menu v-else class="w-5 h-5" />
          </button>
          <h1 class="font-display text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100">
            {{ pageTitle }}
          </h1>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-warm-50 dark:hover:bg-slate-800"
            :aria-label="theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="theme.toggle()"
          >
            <Sun v-if="theme.mode === 'dark'" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>
          <div class="hidden sm:flex flex-col items-end leading-tight">
            <span class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ auth.user?.firstName }} {{ auth.user?.lastName }}</span>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ isSuperAdmin ? 'Admin' : 'Member' }}</span>
          </div>
          <button
            class="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 px-2 py-1 rounded-lg hover:bg-warm-50 dark:hover:bg-slate-800"
            @click="onLogout"
          >
            <LogOut class="w-4 h-4" />
            <span class="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main class="flex-1 p-4 md:p-8 overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
