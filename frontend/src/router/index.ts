import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('@/pages/SignUp.vue'),
    meta: { public: true, guestOnly: true },
  },
  {
    path: '/otp',
    name: 'otp',
    component: () => import('@/pages/OtpVerify.vue'),
    meta: { public: true, guestOnly: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/Login.vue'),
    meta: { public: true, guestOnly: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/pages/Dashboard.vue'),
    meta: { layout: 'app' },
  },
  // ---------- Admin (super_admin only) ----------
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: () => import('@/pages/AdminDashboard.vue'),
    meta: { layout: 'app', requiresRole: 'super_admin', title: 'Admin' },
  },
  {
    path: '/admin/invoices',
    name: 'admin-invoices',
    component: () => import('@/pages/AdminInvoices.vue'),
    meta: { layout: 'app', requiresRole: 'super_admin', title: 'All invoices' },
  },
  {
    path: '/admin/invoices/:id',
    name: 'admin-invoice-detail',
    component: () => import('@/pages/AdminInvoiceDetail.vue'),
    meta: { layout: 'app', requiresRole: 'super_admin', title: 'Invoice' },
  },
  {
    path: '/admin/payment-settings',
    name: 'admin-payment-settings',
    component: () => import('@/pages/AdminPaymentSettings.vue'),
    meta: { layout: 'app', requiresRole: 'super_admin', title: 'Payment settings' },
  },
  {
    path: '/admin/groups',
    name: 'admin-groups',
    component: () => import('@/pages/AdminGroups.vue'),
    meta: { layout: 'app', requiresRole: 'super_admin', title: 'All groups' },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('@/pages/AdminUsers.vue'),
    meta: { layout: 'app', requiresRole: 'super_admin', title: 'All users' },
  },
  {
    path: '/admin/whatsapp-logs',
    name: 'admin-whatsapp-logs',
    component: () => import('@/pages/AdminWhatsappLogs.vue'),
    meta: { layout: 'app', requiresRole: 'super_admin', title: 'WhatsApp logs' },
  },
  // ---------- Customer ----------
  {
    path: '/invoices',
    name: 'customer-invoices',
    component: () => import('@/pages/CustomerInvoices.vue'),
    meta: { layout: 'app', title: 'My invoices' },
  },
  {
    path: '/invoices/:id',
    name: 'customer-invoice-detail',
    component: () => import('@/pages/CustomerInvoiceDetail.vue'),
    meta: { layout: 'app', title: 'Invoice' },
  },
  // ---------- Groups ----------
  {
    path: '/groups',
    name: 'group-list',
    component: () => import('@/pages/GroupDetail.vue'),
    meta: { layout: 'app', title: 'My group' },
  },
  {
    path: '/groups/:id',
    name: 'group-detail',
    component: () => import('@/pages/GroupDetail.vue'),
    meta: { layout: 'app', title: 'My group' },
  },
  {
    path: '/groups/:id/settings',
    name: 'group-settings',
    component: () => import('@/pages/GroupSettings.vue'),
    meta: { layout: 'app', title: 'Group settings' },
  },
  {
    path: '/help',
    name: 'help',
    component: () => import('@/pages/Help.vue'),
    meta: { layout: 'app', title: 'User guide' },
  },
  {
    path: '/groups/:id/cycles',
    name: 'group-cycles',
    component: () => import('@/pages/GroupCycles.vue'),
    meta: { layout: 'app', title: 'Cycles' },
  },
  {
    path: '/groups/:id/reports',
    name: 'group-reports',
    component: () => import('@/pages/GroupReports.vue'),
    meta: { layout: 'app', title: 'Reports' },
  },
  {
    path: '/groups/:id/loans',
    name: 'group-loans',
    component: () => import('@/pages/GroupLoans.vue'),
    meta: { layout: 'app', title: 'Loans' },
  },
  // ---------- Public (token in URL is the auth) ----------
  {
    path: '/create-group',
    name: 'create-group',
    component: () => import('@/pages/CreateGroup.vue'),
    meta: { public: true, title: 'Create your group' },
  },
  {
    path: '/:pathMatch(.*)*',
    component: () => import('@/pages/NotFound.vue'),
    meta: { public: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.bootstrapped) {
    await auth.restore();
  }

  const isAuthed = auth.isAuthenticated;

  if (to.meta.guestOnly && isAuthed) {
    return { name: 'dashboard' };
  }
  if (!to.meta.public && !isAuthed) {
    return { name: 'login', query: { next: to.fullPath } };
  }
  // Platform role only (e.g. super_admin). Group roles (owner/treasurer) are
  // enforced by the API and checked in each group page component.
  if (to.meta.requiresRole && auth.user?.role !== to.meta.requiresRole) {
    return { name: 'dashboard' };
  }
  return true;
});

export default router;
