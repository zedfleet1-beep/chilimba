import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as adminApi from '@/api/admin';
import { getErrorMessage } from '@/api/client';

export const useAdminStore = defineStore('admin', () => {
  const stats = ref<adminApi.AdminStats | null>(null);
  const groups = ref<adminApi.AdminGroup[]>([]);
  const users = ref<adminApi.AdminUser[]>([]);
  const whatsappLogs = ref<adminApi.WhatsappLog[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchStats() {
    loading.value = true;
    error.value = null;
    try {
      stats.value = await adminApi.getStats();
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchGroups() {
    loading.value = true;
    error.value = null;
    try {
      groups.value = await adminApi.listGroups();
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchUsers() {
    loading.value = true;
    error.value = null;
    try {
      users.value = await adminApi.listUsers();
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function fetchWhatsappLogs(status?: string) {
    loading.value = true;
    error.value = null;
    try {
      whatsappLogs.value = await adminApi.listWhatsappLogs({ limit: 100, status });
    } catch (e) {
      error.value = getErrorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  async function suspendGroup(id: string) {
    await adminApi.suspendGroup(id);
    await fetchGroups();
  }

  async function reactivateGroup(id: string) {
    await adminApi.reactivateGroup(id);
    await fetchGroups();
  }

  async function suspendUser(id: string) {
    await adminApi.suspendUser(id);
    await fetchUsers();
  }

  async function sendWhatsapp(phone: string, message: string) {
    await adminApi.sendWhatsapp({ phone, message });
    await fetchWhatsappLogs();
  }

  return {
    stats,
    groups,
    users,
    whatsappLogs,
    loading,
    error,
    fetchStats,
    fetchGroups,
    fetchUsers,
    fetchWhatsappLogs,
    suspendGroup,
    reactivateGroup,
    suspendUser,
    sendWhatsapp,
  };
});