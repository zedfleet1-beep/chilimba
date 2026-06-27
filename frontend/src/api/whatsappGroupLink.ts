import { api } from './client';

export interface WhatsappLinkInfo {
  botPhone: string | null;
  linked: { jid: string } | null;
  pending: { jid: string; subject: string | null; expiresAt: string } | null;
}

export interface WhatsappGroupOption {
  jid: string;
  name: string;
  participantCount?: number;
}

export async function getLinkInfo(groupId: string): Promise<WhatsappLinkInfo> {
  const { data } = await api.get<{ success: true; data: WhatsappLinkInfo }>(
    `/groups/${groupId}/whatsapp/link-info`,
  );
  return data.data;
}

export async function listLinkableGroups(groupId: string): Promise<WhatsappGroupOption[]> {
  const { data } = await api.get<{ success: true; data: { groups: WhatsappGroupOption[] } }>(
    `/groups/${groupId}/whatsapp/groups`,
  );
  return data.data.groups;
}

export async function sendVerification(
  groupId: string,
  input: { jid: string; subject?: string },
): Promise<{ jid: string; subject: string; expiresAt: string; message: string }> {
  const { data } = await api.post<{
    success: true;
    data: { jid: string; subject: string; expiresAt: string; message: string };
  }>(`/groups/${groupId}/whatsapp/send-verification`, input);
  return data.data;
}

export async function verifyLink(
  groupId: string,
  code: string,
): Promise<{ linked: { jid: string; subject: string | null } }> {
  const { data } = await api.post<{
    success: true;
    data: { linked: { jid: string; subject: string | null } };
  }>(`/groups/${groupId}/whatsapp/verify`, { code });
  return data.data;
}

export async function unlinkGroup(groupId: string): Promise<void> {
  await api.delete(`/groups/${groupId}/whatsapp/link`);
}