import { api } from './client';
import type { GroupMember } from './groups';

export type CycleStatus = 'open' | 'in_progress' | 'completed';
export type RoundStatus = 'pending' | 'collecting' | 'paid_out' | 'completed';
export type ContributionStatus = 'pending' | 'paid' | 'late' | 'waived';

export interface Cycle {
  id: string;
  groupId: string;
  cycleNumber: number;
  status: CycleStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CycleRound {
  id: string;
  cycleId: string;
  roundNumber: number;
  dueDate: string;
  status: RoundStatus;
  totalCollectedNgwe: string;
  createdAt: string;
  recipients: Array<{ id: string; memberId: string }>;
  contributions?: Array<{
    id: string;
    memberId: string;
    status: ContributionStatus;
    paidDate: string | null;
  }>;
  payouts?: Array<{
    id: string;
    memberId: string;
    amountNgwe: string;
    paidAt: string | null;
  }>;
}

export interface CycleDetail extends Cycle {
  group: { id: string; name: string; template: string };
  rounds: CycleRound[];
}

export interface Contribution {
  id: string;
  groupId: string;
  cycleId: string;
  roundId: string;
  memberId: string;
  amountNgwe: string;
  dueDate: string;
  paidDate: string | null;
  status: ContributionStatus;
  proofUrl: string | null;
  notes: string | null;
  member?: GroupMember;
}

export interface CyclePayout {
  id: string;
  roundId: string;
  memberId: string;
  amountNgwe: string;
  paidAt: string | null;
  proofUrl: string | null;
  notes: string | null;
  member?: GroupMember;
}

export async function listCycles(groupId: string): Promise<Cycle[]> {
  const { data } = await api.get<{ success: true; data: Cycle[] }>(`/groups/${groupId}/cycles`);
  return data.data;
}

export async function openCycle(groupId: string): Promise<CycleDetail> {
  const { data } = await api.post<{ success: true; data: CycleDetail }>(`/groups/${groupId}/cycles`, {});
  return data.data;
}

export async function getCycle(groupId: string, cycleId: string): Promise<CycleDetail> {
  const { data } = await api.get<{ success: true; data: CycleDetail }>(`/groups/${groupId}/cycles/${cycleId}`);
  return data.data;
}

export async function startCycle(groupId: string, cycleId: string): Promise<CycleDetail> {
  const { data } = await api.post<{ success: true; data: CycleDetail }>(
    `/groups/${groupId}/cycles/${cycleId}/start`,
    {},
  );
  return data.data;
}

export async function completeCycle(groupId: string, cycleId: string): Promise<Cycle> {
  const { data } = await api.post<{ success: true; data: Cycle }>(
    `/groups/${groupId}/cycles/${cycleId}/complete`,
    {},
  );
  return data.data;
}

export async function listContributions(groupId: string, cycleId: string, roundId: string): Promise<Contribution[]> {
  const { data } = await api.get<{ success: true; data: Contribution[] }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/contributions`,
  );
  return data.data;
}

export async function uploadContributionProof(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
  file: File,
): Promise<Contribution> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ success: true; data: Contribution }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/contributions/upload/${memberId}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function recordContribution(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
  notes?: string,
): Promise<Contribution> {
  const { data } = await api.post<{ success: true; data: Contribution }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/contributions/${memberId}/record`,
    { notes },
  );
  return data.data;
}

export async function approveContribution(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
): Promise<Contribution> {
  const { data } = await api.post<{ success: true; data: Contribution }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/contributions/${memberId}/approve`,
    {},
  );
  return data.data;
}

export async function rejectContribution(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
  reason: string,
): Promise<Contribution> {
  const { data } = await api.post<{ success: true; data: Contribution }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/contributions/${memberId}/reject`,
    { reason },
  );
  return data.data;
}

export async function waiveContribution(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
): Promise<Contribution> {
  const { data } = await api.post<{ success: true; data: Contribution }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/contributions/${memberId}/waive`,
    {},
  );
  return data.data;
}

export async function listPayouts(groupId: string, cycleId: string, roundId: string): Promise<CyclePayout[]> {
  const { data } = await api.get<{ success: true; data: CyclePayout[] }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/payouts`,
  );
  return data.data;
}

export async function recordPayout(
  groupId: string,
  cycleId: string,
  roundId: string,
  input: { notes?: string; file?: File },
): Promise<{ payouts: CyclePayout[]; totalDistributedNgwe: string }> {
  const form = new FormData();
  if (input.notes) form.append('notes', input.notes);
  if (input.file) form.append('file', input.file);
  const { data } = await api.post<{
    success: true;
    data: { payouts: CyclePayout[]; totalDistributedNgwe: string };
  }>(`/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/payouts/record`, form);
  return data.data;
}

export async function rerollPayouts(groupId: string, cycleId: string, roundId: string): Promise<CyclePayout[]> {
  const { data } = await api.post<{ success: true; data: CyclePayout[] }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/payouts/reroll`,
    {},
  );
  return data.data;
}

export async function assignPayoutRecipients(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberIds: string[],
): Promise<CyclePayout[]> {
  const { data } = await api.post<{ success: true; data: CyclePayout[] }>(
    `/groups/${groupId}/cycles/${cycleId}/rounds/${roundId}/payouts/assign`,
    { memberIds },
  );
  return data.data;
}
