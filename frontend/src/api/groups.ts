/**
 * Group + member API client. Mirrors backend/src/modules/groups.
 */
import { api } from './client';
import type { PaymentSettingInput, PaymentSettingRow } from '@/api/paymentSettings';

export type GroupTemplate = 'rotating_cash' | 'grocery' | 'custom';
export type GroupStatus = 'active' | 'suspended' | 'closed';
export type MemberRole = 'owner' | 'treasurer' | 'member';
export type MemberStatus = 'active' | 'suspended' | 'exited';
export type PayoutMethod = 'queue' | 'random' | 'manual' | 'voting';
export type ContributionFrequency = 'weekly' | 'fortnightly' | 'monthly';

export interface GroupSetting {
  id: string;
  groupId: string;
  maxMembers: number;
  contributionAmountNgwe: string;
  contributionFrequency: ContributionFrequency;
  gracePeriodDays: number;
  latePenaltyNgwe: string;
  payoutRecipientsCount: number;
  payoutMethod: PayoutMethod;
  allowLoans: boolean;
  maxLoanMultiplier: number;
  loanInterestRate: number;
  absencePenaltyNgwe: string;
  exitPenaltyPercent: number;
  whatsappReminders: boolean;
  reminderDaysBefore: number;
  autoOpenNextCycle: boolean;
  whatsappGroupJid: string | null;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  payoutPosition: number | null;
  joinedAt: string;
  exitedAt: string | null;
  user?: { id: string; firstName: string; lastName: string; phone: string };
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  invoiceId: string;
  ownerId: string;
  status: GroupStatus;
  template: GroupTemplate;
  country: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  settings?: GroupSetting | null;
  members?: GroupMember[];
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  template: GroupTemplate;
  country?: string;
  currency?: string;
}

export interface CreateGroupResult {
  group: Group;
  owner: GroupMember;
  ownerUser: { id: string; firstName: string; lastName: string; phone: string };
}

// ---------- Token-based group creation ----------

export async function createGroupFromToken(
  token: string,
  input: CreateGroupInput,
): Promise<CreateGroupResult> {
  const { data } = await api.post<{ success: true; data: CreateGroupResult }>(
    '/groups',
    input,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data.data;
}

export async function lookupInvoiceByToken(token: string): Promise<{
  invoiceNumber: string;
  amountNgwe: string;
}> {
  const { data } = await api.get<{ success: true; data: { invoiceNumber: string; amountNgwe: string } }>(
    '/groups/lookup-by-token',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data.data;
}

// ---------- Authenticated routes ----------

export async function listMyGroups(): Promise<
  Array<Group & { settings: GroupSetting | null; memberCount: number; myRole: MemberRole }>
> {
  const { data } = await api.get<{
    success: true;
    data: Array<Group & { settings: GroupSetting | null; memberCount: number; myRole: MemberRole }>;
  }>('/groups');
  return data.data;
}

export async function getGroup(id: string): Promise<Group> {
  const { data } = await api.get<{ success: true; data: Group }>(`/groups/${id}`);
  return data.data;
}

export interface UpdateGroupSettingsInput {
  name?: string;
  description?: string | null;
  maxMembers?: number;
  contributionAmountNgwe?: number | string;
  contributionFrequency?: ContributionFrequency;
  gracePeriodDays?: number;
  latePenaltyNgwe?: number | string;
  payoutRecipientsCount?: number;
  payoutMethod?: PayoutMethod;
  allowLoans?: boolean;
  maxLoanMultiplier?: number;
  loanInterestRate?: number;
  absencePenaltyNgwe?: number | string;
  exitPenaltyPercent?: number;
  whatsappReminders?: boolean;
  reminderDaysBefore?: number;
  autoOpenNextCycle?: boolean;
}

export async function updateGroupSettings(
  id: string,
  patch: UpdateGroupSettingsInput,
): Promise<GroupSetting> {
  const { data } = await api.put<{ success: true; data: GroupSetting }>(
    `/groups/${id}/settings`,
    patch,
  );
  return data.data;
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const { data } = await api.get<{ success: true; data: GroupMember[] }>(`/groups/${groupId}/members`);
  return data.data;
}

export interface AddMemberInput {
  firstName: string;
  lastName: string;
  phone: string;
  role?: MemberRole;
  payoutPosition?: number;
  skipInvite?: boolean;
}

export async function addMember(groupId: string, input: AddMemberInput): Promise<GroupMember> {
  const { data } = await api.post<{ success: true; data: GroupMember }>(
    `/groups/${groupId}/members`,
    input,
  );
  return data.data;
}

export interface UpdateMemberInput {
  role?: MemberRole;
  payoutPosition?: number;
}

export async function updateMember(
  groupId: string,
  memberId: string,
  patch: UpdateMemberInput,
): Promise<GroupMember> {
  const { data } = await api.put<{ success: true; data: GroupMember }>(
    `/groups/${groupId}/members/${memberId}`,
    patch,
  );
  return data.data;
}

export async function getGroupContributionPayment(groupId: string): Promise<PaymentSettingRow | null> {
  const { data } = await api.get<{ success: true; data: PaymentSettingRow | null }>(
    `/groups/${groupId}/contribution-payment`,
  );
  return data.data;
}

export async function upsertGroupContributionPayment(
  groupId: string,
  input: PaymentSettingInput,
): Promise<PaymentSettingRow> {
  const { data } = await api.put<{ success: true; data: PaymentSettingRow }>(
    `/groups/${groupId}/contribution-payment`,
    input,
  );
  return data.data;
}

export async function removeMember(groupId: string, memberId: string): Promise<GroupMember> {
  const { data } = await api.delete<{ success: true; data: GroupMember }>(
    `/groups/${groupId}/members/${memberId}`,
  );
  return data.data;
}
