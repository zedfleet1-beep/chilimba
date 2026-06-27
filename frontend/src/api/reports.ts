import { api } from './client';

export interface CycleSummary {
  group: { id: string; name: string };
  cycle: {
    id: string;
    cycleNumber: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  totalCollectedNgwe: string;
  totalPaidOutNgwe: string;
  balanceNgwe: string;
  rounds: Array<{
    id: string;
    roundNumber: number;
    status: string;
    dueDate: string;
    collectedNgwe: string;
    paidOutNgwe: string;
    contributionCount: number;
    payoutCount: number;
  }>;
}

export interface MemberStatement {
  member: { id: string; firstName: string; lastName: string; phone: string; role: string };
  totalContributedNgwe: string;
  totalReceivedNgwe: string;
  netPositionNgwe: string;
  contributions: Array<{
    id: string;
    cycleNumber: number;
    roundNumber: number;
    amountNgwe: string;
    status: string;
    paidDate: string | null;
  }>;
  payouts: Array<{
    id: string;
    cycleNumber: number;
    roundNumber: number;
    amountNgwe: string;
    paidAt: string | null;
  }>;
  loans: Array<{
    id: string;
    amountNgwe: string;
    totalDueNgwe: string;
    amountRepaidNgwe: string;
    status: string;
    requestedAt: string;
    repayments: Array<{ id: string; amountNgwe: string; paidAt: string }>;
  }>;
}

export interface OutstandingReport {
  group: { id: string; name: string };
  cycle: { id: string; cycleNumber: number } | null;
  round: {
    id: string;
    roundNumber: number;
    dueDate: string;
    totalCollectedNgwe: string;
  } | null;
  expectedAmountNgwe?: string;
  members: Array<{
    memberId: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: string;
  }>;
}

export interface LoanBook {
  group: { id: string; name: string; allowLoans: boolean };
  totalOutstandingNgwe: string;
  activeCount: number;
  loans: Array<{
    id: string;
    member: { id: string; firstName: string; lastName: string; phone: string };
    amountNgwe: string;
    totalDueNgwe: string;
    amountRepaidNgwe: string;
    balanceNgwe: string;
    status: string;
    purpose: string | null;
    requestedAt: string;
    dueDate: string | null;
    repayments: Array<{ id: string; amountNgwe: string; paidAt: string; notes: string | null }>;
  }>;
}

export async function getCycleSummary(groupId: string, cycleId?: string): Promise<CycleSummary> {
  const { data } = await api.get<{ success: true; data: CycleSummary }>(
    `/groups/${groupId}/reports/cycle-summary`,
    { params: cycleId ? { cycleId } : undefined },
  );
  return data.data;
}

export async function getMemberStatement(
  groupId: string,
  memberId: string,
  cycleId?: string,
): Promise<MemberStatement> {
  const { data } = await api.get<{ success: true; data: MemberStatement }>(
    `/groups/${groupId}/reports/member-statement`,
    { params: { memberId, ...(cycleId ? { cycleId } : {}) } },
  );
  return data.data;
}

export async function getOutstanding(groupId: string, cycleId?: string): Promise<OutstandingReport> {
  const { data } = await api.get<{ success: true; data: OutstandingReport }>(
    `/groups/${groupId}/reports/outstanding`,
    { params: cycleId ? { cycleId } : undefined },
  );
  return data.data;
}

export async function getLoanBook(groupId: string): Promise<LoanBook> {
  const { data } = await api.get<{ success: true; data: LoanBook }>(`/groups/${groupId}/reports/loan-book`);
  return data.data;
}

export interface PayoutLedgerRow {
  roundId: string;
  roundNumber: number;
  monthLabel: string;
  dueDate: string;
  recipients: string[];
  amountNgwe: string;
  amountLabel: string;
  status: string;
}

export interface PayoutLedger {
  group: { id: string; name: string };
  cycle: { id: string; cycleNumber: number; status: string } | null;
  frequency: 'weekly' | 'fortnightly' | 'monthly';
  rows: PayoutLedgerRow[];
}

export async function getPayoutLedger(groupId: string, cycleId?: string): Promise<PayoutLedger> {
  const { data } = await api.get<{ success: true; data: PayoutLedger }>(
    `/groups/${groupId}/reports/payout-ledger`,
    { params: cycleId ? { cycleId } : undefined },
  );
  return data.data;
}

export async function downloadPayoutLedgerPdf(groupId: string, cycleId?: string): Promise<void> {
  const res = await api.get(`/groups/${groupId}/reports/payout-ledger.pdf`, {
    params: cycleId ? { cycleId } : undefined,
    responseType: 'blob',
  });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payout-ledger.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}