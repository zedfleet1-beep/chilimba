import { api } from './client';

export interface AdminStats {
  activeGroups: number;
  totalMembers: number;
  pendingPopReviews: number;
  revenueThisMonthNgwe: string;
  whatsappSentToday: number;
  whatsappFailedRecent: number;
}

export interface AdminGroup {
  id: string;
  name: string;
  status: string;
  template: string;
  owner: { id: string; firstName: string; lastName: string; phone: string };
  memberCount: number;
  cycleCount: number;
  settings: {
    contributionAmountNgwe: string;
    contributionFrequency: string;
  } | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: string;
  status: string;
  otpVerified: boolean;
  groupCount: number;
  createdAt: string;
}

export interface WhatsappLog {
  id: string;
  toPhone: string;
  message: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
}

export async function getStats(): Promise<AdminStats> {
  const { data } = await api.get<{ success: true; data: AdminStats }>('/admin/stats');
  return data.data;
}

export async function listGroups(): Promise<AdminGroup[]> {
  const { data } = await api.get<{ success: true; data: AdminGroup[] }>('/admin/groups');
  return data.data;
}

export async function suspendGroup(id: string): Promise<void> {
  await api.post(`/admin/groups/${id}/suspend`);
}

export async function reactivateGroup(id: string): Promise<void> {
  await api.post(`/admin/groups/${id}/reactivate`);
}

export async function listUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<{ success: true; data: AdminUser[] }>('/admin/users');
  return data.data;
}

export async function suspendUser(id: string): Promise<void> {
  await api.post(`/admin/users/${id}/suspend`);
}

export async function listWhatsappLogs(params?: {
  limit?: number;
  status?: string;
}): Promise<WhatsappLog[]> {
  const { data } = await api.get<{ success: true; data: WhatsappLog[] }>('/admin/whatsapp-logs', { params });
  return data.data;
}

export async function sendWhatsapp(input: { phone: string; message: string }): Promise<void> {
  await api.post('/admin/whatsapp/send', input);
}