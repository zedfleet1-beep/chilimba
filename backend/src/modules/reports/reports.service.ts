/**
 * Group reports — cycle summary, member statements, outstanding, loan book.
 */
import { ContributionStatus, ContributionFrequency, CycleStatus, LoanStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NotFoundError } from '@/lib/errors';
import { formatRoundLabel } from '@/lib/roundLabels';
import { formatNgwe } from '@/lib/money';

async function assertGroupMember(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { settings: true },
  });
  if (!group) throw new NotFoundError('Group');
  return group;
}

async function resolveCycle(groupId: string, cycleId?: string) {
  if (cycleId) {
    const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.groupId !== groupId) throw new NotFoundError('Cycle');
    return cycle;
  }
  const cycle = await prisma.cycle.findFirst({
    where: { groupId, status: { in: [CycleStatus.open, CycleStatus.in_progress] } },
    orderBy: { cycleNumber: 'desc' },
  });
  if (!cycle) {
    return prisma.cycle.findFirst({
      where: { groupId },
      orderBy: { cycleNumber: 'desc' },
    });
  }
  return cycle;
}

export async function getCycleSummary(groupId: string, cycleId?: string) {
  const group = await assertGroupMember(groupId);
  const cycle = await resolveCycle(groupId, cycleId);
  if (!cycle) {
    return {
      group: { id: group.id, name: group.name },
      cycle: null,
      totalCollectedNgwe: '0',
      totalPaidOutNgwe: '0',
      balanceNgwe: '0',
      rounds: [],
    };
  }

  const rounds = await prisma.cycleRound.findMany({
    where: { cycleId: cycle.id },
    orderBy: { roundNumber: 'asc' },
    include: {
      contributions: { select: { status: true, amountNgwe: true } },
      payouts: { select: { amountNgwe: true, paidAt: true } },
    },
  });

  let totalCollected = 0n;
  let totalPaidOut = 0n;
  const roundSummaries = rounds.map((round) => {
    const collected = round.contributions
      .filter((c) => c.status === ContributionStatus.paid || c.status === ContributionStatus.late)
      .reduce((sum, c) => sum + c.amountNgwe, 0n);
    const paidOut = round.payouts
      .filter((p) => p.paidAt !== null)
      .reduce((sum, p) => sum + p.amountNgwe, 0n);
    totalCollected += collected;
    totalPaidOut += paidOut;
    return {
      id: round.id,
      roundNumber: round.roundNumber,
      status: round.status,
      dueDate: round.dueDate,
      collectedNgwe: String(collected),
      paidOutNgwe: String(paidOut),
      contributionCount: round.contributions.length,
      payoutCount: round.payouts.length,
    };
  });

  return {
    group: { id: group.id, name: group.name },
    cycle: {
      id: cycle.id,
      cycleNumber: cycle.cycleNumber,
      status: cycle.status,
      startedAt: cycle.startedAt,
      completedAt: cycle.completedAt,
    },
    totalCollectedNgwe: String(totalCollected),
    totalPaidOutNgwe: String(totalPaidOut),
    balanceNgwe: String(totalCollected - totalPaidOut),
    rounds: roundSummaries,
  };
}

export async function getMemberStatement(groupId: string, memberId: string, cycleId?: string) {
  await assertGroupMember(groupId);
  const member = await prisma.groupMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { firstName: true, lastName: true, phone: true } } },
  });
  if (!member || member.groupId !== groupId) throw new NotFoundError('Member');

  const contributionWhere = cycleId
    ? { groupId, memberId, cycleId }
    : { groupId, memberId };

  const [contributions, payouts, loans] = await Promise.all([
    prisma.contribution.findMany({
      where: contributionWhere,
      orderBy: { createdAt: 'asc' },
      include: { round: { select: { roundNumber: true } }, cycle: { select: { cycleNumber: true } } },
    }),
    prisma.cyclePayout.findMany({
      where: { memberId, round: { cycle: cycleId ? { id: cycleId, groupId } : { groupId } } },
      orderBy: { paidAt: 'asc' },
      include: { round: { select: { roundNumber: true, cycle: { select: { cycleNumber: true } } } } },
    }),
    prisma.loan.findMany({
      where: { groupId, memberId },
      orderBy: { requestedAt: 'desc' },
      include: { repayments: { orderBy: { paidAt: 'asc' } } },
    }),
  ]);

  const totalContributed = contributions
    .filter((c) => c.status === ContributionStatus.paid || c.status === ContributionStatus.late)
    .reduce((sum, c) => sum + c.amountNgwe, 0n);
  const totalReceived = payouts
    .filter((p) => p.paidAt !== null)
    .reduce((sum, p) => sum + p.amountNgwe, 0n);

  return {
    member: {
      id: member.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      phone: member.user.phone,
      role: member.role,
    },
    totalContributedNgwe: String(totalContributed),
    totalReceivedNgwe: String(totalReceived),
    netPositionNgwe: String(totalContributed - totalReceived),
    contributions: contributions.map((c) => ({
      id: c.id,
      cycleNumber: c.cycle.cycleNumber,
      roundNumber: c.round.roundNumber,
      amountNgwe: String(c.amountNgwe),
      status: c.status,
      paidDate: c.paidDate,
    })),
    payouts: payouts.map((p) => ({
      id: p.id,
      cycleNumber: p.round.cycle.cycleNumber,
      roundNumber: p.round.roundNumber,
      amountNgwe: String(p.amountNgwe),
      paidAt: p.paidAt,
    })),
    loans: loans.map((l) => ({
      id: l.id,
      amountNgwe: String(l.amountNgwe),
      totalDueNgwe: String(l.totalDueNgwe),
      amountRepaidNgwe: String(l.amountRepaidNgwe),
      status: l.status,
      requestedAt: l.requestedAt,
      repayments: l.repayments.map((r) => ({
        id: r.id,
        amountNgwe: String(r.amountNgwe),
        paidAt: r.paidAt,
      })),
    })),
  };
}

export async function getOutstandingContributions(groupId: string, cycleId?: string) {
  const group = await assertGroupMember(groupId);
  const cycle = await resolveCycle(groupId, cycleId);
  if (!cycle) {
    return { group: { id: group.id, name: group.name }, cycle: null, members: [] };
  }

  const activeRound = await prisma.cycleRound.findFirst({
    where: {
      cycleId: cycle.id,
      status: { in: ['pending', 'collecting'] },
    },
    orderBy: { roundNumber: 'asc' },
  });
  if (!activeRound) {
    return {
      group: { id: group.id, name: group.name },
      cycle: { id: cycle.id, cycleNumber: cycle.cycleNumber },
      round: null,
      members: [],
    };
  }

  const members = await prisma.groupMember.findMany({
    where: { groupId, status: 'active' },
    include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    orderBy: { payoutPosition: 'asc' },
  });
  const contributions = await prisma.contribution.findMany({
    where: { cycleId: cycle.id, roundId: activeRound.id },
  });
  const statusByMember = new Map(contributions.map((c) => [c.memberId, c.status]));

  const outstanding = members
    .filter((m) => {
      const status = statusByMember.get(m.id);
      return !status || status === ContributionStatus.pending || status === ContributionStatus.late;
    })
    .map((m) => ({
      memberId: m.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      phone: m.user.phone,
      status: statusByMember.get(m.id) ?? 'pending',
    }));

  return {
    group: { id: group.id, name: group.name },
    cycle: { id: cycle.id, cycleNumber: cycle.cycleNumber },
    round: {
      id: activeRound.id,
      roundNumber: activeRound.roundNumber,
      dueDate: activeRound.dueDate,
      totalCollectedNgwe: String(activeRound.totalCollectedNgwe),
    },
    expectedAmountNgwe: String(group.settings?.contributionAmountNgwe ?? 0n),
    members: outstanding,
  };
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

export interface PayoutLedgerResult {
  group: { id: string; name: string };
  cycle: { id: string; cycleNumber: number; status: string } | null;
  frequency: ContributionFrequency;
  rows: PayoutLedgerRow[];
}

function payoutRoundStatus(
  roundStatus: string,
  payouts: Array<{ paidAt: Date | null }>,
): string {
  if (payouts.length === 0) return 'Recipients not set';
  const paidCount = payouts.filter((p) => p.paidAt !== null).length;
  if (paidCount === payouts.length || roundStatus === 'completed') return 'Paid';
  if (paidCount > 0) return 'Partial';
  return 'Awaiting payment';
}

export async function getPayoutLedger(groupId: string, cycleId?: string): Promise<PayoutLedgerResult> {
  const group = await assertGroupMember(groupId);
  const cycle = await resolveCycle(groupId, cycleId);
  const frequency = (group.settings?.contributionFrequency ?? 'monthly') as ContributionFrequency;

  if (!cycle) {
    return {
      group: { id: group.id, name: group.name },
      cycle: null,
      frequency,
      rows: [],
    };
  }

  const activeMemberCount = await prisma.groupMember.count({
    where: { groupId, status: 'active' },
  });

  const rounds = await prisma.cycleRound.findMany({
    where: { cycleId: cycle.id },
    orderBy: { roundNumber: 'asc' },
    include: {
      payouts: {
        include: {
          member: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });

  const rows: PayoutLedgerRow[] = rounds.map((round) => {
    const paidPayouts = round.payouts.filter((p) => p.paidAt !== null);
    const totalPaid = paidPayouts.reduce((sum, p) => sum + p.amountNgwe, 0n);

    let amountNgwe = totalPaid;
    if (amountNgwe === 0n) {
      if (round.totalCollectedNgwe > 0n) {
        amountNgwe = round.totalCollectedNgwe;
      } else if (group.settings) {
        amountNgwe = group.settings.contributionAmountNgwe * BigInt(activeMemberCount);
      }
    }

    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      monthLabel: formatRoundLabel(round.roundNumber, round.dueDate, frequency),
      dueDate: round.dueDate.toISOString(),
      recipients: round.payouts.map(
        (p) => `${p.member.user.firstName} ${p.member.user.lastName}`,
      ),
      amountNgwe: String(amountNgwe),
      amountLabel: formatNgwe(amountNgwe),
      status: payoutRoundStatus(round.status, round.payouts),
    };
  });

  return {
    group: { id: group.id, name: group.name },
    cycle: { id: cycle.id, cycleNumber: cycle.cycleNumber, status: cycle.status },
    frequency,
    rows,
  };
}

export async function getLoanBook(groupId: string) {
  const group = await assertGroupMember(groupId);
  const loans = await prisma.loan.findMany({
    where: { groupId },
    orderBy: { requestedAt: 'desc' },
    include: {
      member: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
      repayments: { orderBy: { paidAt: 'desc' } },
    },
  });

  const activeStatuses: LoanStatus[] = [LoanStatus.pending, LoanStatus.approved, LoanStatus.active];
  const activeLoans = loans.filter((l) => activeStatuses.includes(l.status));
  const totalOutstanding = activeLoans.reduce(
    (sum, l) => sum + (l.totalDueNgwe - l.amountRepaidNgwe),
    0n,
  );

  return {
    group: { id: group.id, name: group.name, allowLoans: group.settings?.allowLoans ?? false },
    totalOutstandingNgwe: String(totalOutstanding),
    activeCount: activeLoans.length,
    loans: loans.map((l) => ({
      id: l.id,
      member: {
        id: l.member.id,
        firstName: l.member.user.firstName,
        lastName: l.member.user.lastName,
        phone: l.member.user.phone,
      },
      amountNgwe: String(l.amountNgwe),
      totalDueNgwe: String(l.totalDueNgwe),
      amountRepaidNgwe: String(l.amountRepaidNgwe),
      balanceNgwe: String(l.totalDueNgwe - l.amountRepaidNgwe),
      status: l.status,
      purpose: l.purpose,
      requestedAt: l.requestedAt,
      dueDate: l.dueDate,
      repayments: l.repayments.map((r) => ({
        id: r.id,
        amountNgwe: String(r.amountNgwe),
        paidAt: r.paidAt,
        notes: r.notes,
      })),
    })),
  };
}