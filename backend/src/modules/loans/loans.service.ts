/**
 * Loans service — request, approve, reject, record repayments.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { GroupMemberRole, LoanStatus, ContributionStatus, CycleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';

function computeTotalDue(amountNgwe: bigint, interestRate: Decimal): bigint {
  const rate = Number(interestRate);
  const interest = BigInt(Math.round(Number(amountNgwe) * rate));
  return amountNgwe + interest;
}

async function hasActiveCycle(groupId: string): Promise<boolean> {
  const active = await prisma.cycle.findFirst({
    where: {
      groupId,
      status: { in: [CycleStatus.open, CycleStatus.in_progress] },
    },
    select: { id: true },
  });
  return !!active;
}

async function memberSavingsNgwe(groupId: string, memberId: string): Promise<bigint> {
  const paid = await prisma.contribution.aggregate({
    where: {
      groupId,
      memberId,
      status: { in: [ContributionStatus.paid, ContributionStatus.late] },
    },
    _sum: { amountNgwe: true },
  });
  const received = await prisma.cyclePayout.aggregate({
    where: { memberId, paidAt: { not: null }, round: { cycle: { groupId } } },
    _sum: { amountNgwe: true },
  });
  const contributed = paid._sum.amountNgwe ?? 0n;
  const payouts = received._sum.amountNgwe ?? 0n;
  return contributed > payouts ? contributed - payouts : 0n;
}

export async function listLoans(groupId: string) {
  return prisma.loan.findMany({
    where: { groupId },
    orderBy: { requestedAt: 'desc' },
    include: {
      member: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      repayments: { orderBy: { paidAt: 'desc' } },
    },
  });
}

export async function requestLoan(
  groupId: string,
  requester: { memberId: string; userId: string; role: GroupMemberRole },
  input: { amountNgwe: bigint; purpose?: string },
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { settings: true },
  });
  if (!group?.settings) throw new NotFoundError('Group');
  if (!group.settings.allowLoans) {
    throw new ConflictError('LOANS_DISABLED' as never, 'Loans are not enabled for this group');
  }
  if (!(await hasActiveCycle(groupId))) {
    throw new ConflictError(
      'CYCLE_NOT_ACTIVE' as never,
      'Loans can only be requested while a cycle is open or in progress',
    );
  }
  if (input.amountNgwe <= 0n) {
    throw new ValidationError('Loan amount must be greater than zero');
  }

  const activeLoan = await prisma.loan.findFirst({
    where: {
      groupId,
      memberId: requester.memberId,
      status: { in: [LoanStatus.pending, LoanStatus.approved, LoanStatus.active] },
    },
  });
  if (activeLoan) {
    throw new ConflictError('ACTIVE_LOAN_EXISTS' as never, 'You already have an active or pending loan');
  }

  const savings = await memberSavingsNgwe(groupId, requester.memberId);
  const maxLoan = BigInt(
    Math.floor(Number(savings) * Number(group.settings.maxLoanMultiplier)),
  );
  if (input.amountNgwe > maxLoan) {
    throw new ConflictError(
      'LOAN_LIMIT_EXCEEDED' as never,
      `Maximum loan amount is ${maxLoan} ngwe based on your savings`,
    );
  }

  const totalDueNgwe = computeTotalDue(input.amountNgwe, group.settings.loanInterestRate);
  const dueDate = new Date();
  dueDate.setUTCMonth(dueDate.getUTCMonth() + 6);

  return prisma.loan.create({
    data: {
      groupId,
      memberId: requester.memberId,
      amountNgwe: input.amountNgwe,
      interestRate: group.settings.loanInterestRate,
      totalDueNgwe,
      purpose: input.purpose ?? null,
      dueDate,
      status: LoanStatus.pending,
    },
    include: {
      member: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
    },
  });
}

export async function approveLoan(
  groupId: string,
  loanId: string,
  requester: { id: string; role: GroupMemberRole },
) {
  if (requester.role !== GroupMemberRole.owner && requester.role !== GroupMemberRole.treasurer) {
    throw new ForbiddenError('Only the owner or treasurer can approve loans');
  }
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.groupId !== groupId) throw new NotFoundError('Loan');
  if (loan.status !== LoanStatus.pending) {
    throw new ConflictError('LOAN_NOT_PENDING' as never, 'Only pending loans can be approved');
  }

  const now = new Date();
  return prisma.loan.update({
    where: { id: loanId },
    data: {
      status: LoanStatus.active,
      approvedAt: now,
      approvedById: requester.id,
      disbursedAt: now,
    },
    include: {
      member: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
      repayments: true,
    },
  });
}

export async function rejectLoan(
  groupId: string,
  loanId: string,
  requester: { id: string; role: GroupMemberRole },
  reason?: string,
) {
  if (requester.role !== GroupMemberRole.owner && requester.role !== GroupMemberRole.treasurer) {
    throw new ForbiddenError('Only the owner or treasurer can reject loans');
  }
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.groupId !== groupId) throw new NotFoundError('Loan');
  if (loan.status !== LoanStatus.pending) {
    throw new ConflictError('LOAN_NOT_PENDING' as never, 'Only pending loans can be rejected');
  }

  return prisma.loan.update({
    where: { id: loanId },
    data: { status: LoanStatus.rejected, purpose: reason ? `${loan.purpose ?? ''} [Rejected: ${reason}]`.trim() : loan.purpose },
    include: {
      member: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
    },
  });
}

export async function recordRepayment(
  groupId: string,
  loanId: string,
  requester: { id: string; role: GroupMemberRole },
  input: { amountNgwe: bigint; notes?: string },
) {
  if (requester.role !== GroupMemberRole.owner && requester.role !== GroupMemberRole.treasurer) {
    throw new ForbiddenError('Only the owner or treasurer can record repayments');
  }
  if (input.amountNgwe <= 0n) {
    throw new ValidationError('Repayment amount must be greater than zero');
  }

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.groupId !== groupId) throw new NotFoundError('Loan');
  if (loan.status !== LoanStatus.active) {
    throw new ConflictError('LOAN_NOT_ACTIVE' as never, 'Repayments can only be recorded on active loans');
  }

  const newRepaid = loan.amountRepaidNgwe + input.amountNgwe;
  const isFullyRepaid = newRepaid >= loan.totalDueNgwe;

  return prisma.$transaction(async (tx) => {
    await tx.loanRepayment.create({
      data: {
        loanId,
        amountNgwe: input.amountNgwe,
        recordedById: requester.id,
        notes: input.notes ?? null,
      },
    });
    return tx.loan.update({
      where: { id: loanId },
      data: {
        amountRepaidNgwe: newRepaid,
        status: isFullyRepaid ? LoanStatus.repaid : LoanStatus.active,
      },
      include: {
        member: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
        repayments: { orderBy: { paidAt: 'desc' } },
      },
    });
  });
}

export async function getMyLoanEligibility(
  groupId: string,
  requester: { memberId: string },
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { settings: true },
  });
  if (!group?.settings) throw new NotFoundError('Group');

  const savings = await memberSavingsNgwe(groupId, requester.memberId);
  const maxLoanNgwe = BigInt(
    Math.floor(Number(savings) * Number(group.settings.maxLoanMultiplier)),
  );
  const [activeLoan, cycleActive] = await Promise.all([
    prisma.loan.findFirst({
      where: {
        groupId,
        memberId: requester.memberId,
        status: { in: [LoanStatus.pending, LoanStatus.approved, LoanStatus.active] },
      },
    }),
    hasActiveCycle(groupId),
  ]);

  const allowLoans = group.settings.allowLoans;

  return {
    allowLoans,
    savingsNgwe: String(savings),
    maxLoanNgwe: String(maxLoanNgwe),
    interestRate: Number(group.settings.loanInterestRate),
    hasActiveLoan: !!activeLoan,
    activeLoanId: activeLoan?.id ?? null,
    hasActiveCycle: cycleActive,
    canRequestLoan: allowLoans && cycleActive && !activeLoan,
  };
}