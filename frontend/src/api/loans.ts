import { api } from './client';

export interface Loan {
  id: string;
  groupId: string;
  memberId: string;
  amountNgwe: string;
  interestRate: string | number;
  totalDueNgwe: string;
  amountRepaidNgwe: string;
  status: string;
  purpose: string | null;
  requestedAt: string;
  approvedAt: string | null;
  disbursedAt: string | null;
  dueDate: string | null;
  member: {
    id: string;
    user: { id: string; firstName: string; lastName: string; phone: string };
  };
  repayments: Array<{
    id: string;
    amountNgwe: string;
    paidAt: string;
    notes: string | null;
  }>;
}

export interface LoanEligibility {
  allowLoans: boolean;
  savingsNgwe: string;
  maxLoanNgwe: string;
  interestRate: number;
  hasActiveLoan: boolean;
  activeLoanId: string | null;
}

export async function listLoans(groupId: string): Promise<Loan[]> {
  const { data } = await api.get<{ success: true; data: Loan[] }>(`/groups/${groupId}/loans`);
  return data.data;
}

export async function getEligibility(groupId: string): Promise<LoanEligibility> {
  const { data } = await api.get<{ success: true; data: LoanEligibility }>(`/groups/${groupId}/loans/eligibility`);
  return data.data;
}

export async function requestLoan(groupId: string, input: { amountNgwe: number | string; purpose?: string }): Promise<Loan> {
  const { data } = await api.post<{ success: true; data: Loan }>(`/groups/${groupId}/loans`, input);
  return data.data;
}

export async function approveLoan(groupId: string, loanId: string): Promise<Loan> {
  const { data } = await api.post<{ success: true; data: Loan }>(`/groups/${groupId}/loans/${loanId}/approve`);
  return data.data;
}

export async function rejectLoan(groupId: string, loanId: string, reason?: string): Promise<Loan> {
  const { data } = await api.post<{ success: true; data: Loan }>(`/groups/${groupId}/loans/${loanId}/reject`, { reason });
  return data.data;
}

export async function recordRepayment(
  groupId: string,
  loanId: string,
  input: { amountNgwe: number | string; notes?: string },
): Promise<Loan> {
  const { data } = await api.post<{ success: true; data: Loan }>(
    `/groups/${groupId}/loans/${loanId}/repayments`,
    input,
  );
  return data.data;
}