/**
 * Cycles service. Pure business logic, no req/res.
 *
 * Cycle lifecycle: open → in_progress → completed
 * Round lifecycle: pending → collecting → paid_out → completed
 *
 * When a cycle opens, rounds are generated and (for `queue` and `random`)
 * the recipients are pre-assigned. For `manual` / `voting` the recipient
 * is decided later (out of scope for this iteration).
 */
import {
  Prisma,
  Cycle,
  CycleRound,
  CycleStatus,
  RoundStatus,
  GroupMemberRole,
  GroupStatus,
  PayoutMethod,
  ContributionFrequency,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendWhatsApp } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { generateRounds, type GeneratedRound } from '@/lib/cycleScheduler';
import { cycleStartedTemplate } from '@/modules/notifications/templates/cycleStarted';
import { notifyGroup } from '@/lib/groupWhatsApp';
import { formatRoundLabel } from '@/lib/roundLabels';

export interface CycleWithRounds extends Cycle {
  rounds: (CycleRound & { recipients: { id: string; memberId: string }[] })[];
}

export interface CycleDetail extends CycleWithRounds {
  group: { id: string; name: string; template: string };
  rounds: (CycleRound & {
    contributions: { id: string; memberId: string; status: string; paidDate: string | null }[];
    payouts: { id: string; memberId: string; amountNgwe: bigint; paidAt: string | null }[];
    recipients: { id: string; memberId: string }[];
  })[];
}

/**
 * Open a new cycle for the group. Generates N rounds with pre-assigned
 * recipients. The cycle starts in `open` status; the owner calls
 * `startCycle` to flip it to `in_progress`.
 */
export async function openCycle(
  groupId: string,
  requester: { id: string; role: GroupMemberRole },
): Promise<CycleWithRounds> {
  if (requester.role !== GroupMemberRole.owner) {
    throw new ForbiddenError('Only the group owner can open a new cycle');
  }
  return openCycleInternal(groupId, { notify: true });
}

async function openCycleInternal(
  groupId: string,
  opts: { notify?: boolean } = {},
): Promise<CycleWithRounds> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { settings: true, members: { where: { status: 'active' } } },
  });
  if (!group) throw new NotFoundError('Group');
  if (group.status !== GroupStatus.active) {
    throw new ConflictError('GROUP_NOT_ACTIVE' as never, 'This group is not active');
  }
  if (!group.settings) {
    throw new ConflictError('NO_SETTINGS' as never, 'This group has no settings');
  }
  if (group.members.length === 0) {
    throw new ConflictError(
      'NO_MEMBERS' as never,
      'Add at least one active member before opening a cycle',
    );
  }
  if (
    group.settings.payoutRecipientsCount > 0 &&
    group.members.length < group.settings.payoutRecipientsCount
  ) {
    throw new ConflictError(
      'INSUFFICIENT_MEMBERS' as never,
      `Add at least ${group.settings.payoutRecipientsCount} members (or lower payout recipients in Group settings). You currently have ${group.members.length}.`,
    );
  }

  const existing = await prisma.cycle.findFirst({
    where: {
      groupId,
      status: { in: [CycleStatus.open, CycleStatus.in_progress] },
    },
  });
  if (existing) {
    throw new ConflictError(
      'CYCLE_ALREADY_ACTIVE' as never,
      'This group already has an open or in-progress cycle. Complete or cancel it first.',
    );
  }

  const last = await prisma.cycle.findFirst({
    where: { groupId },
    orderBy: { cycleNumber: 'desc' },
    select: { cycleNumber: true },
  });
  const cycleNumber = (last?.cycleNumber ?? 0) + 1;

  const now = new Date();
  const plan = generateRounds({
    members: group.members,
    payoutRecipientsCount: group.settings.payoutRecipientsCount,
    frequency: group.settings.contributionFrequency as ContributionFrequency,
    startDate: now,
    payoutMethod: group.settings.payoutMethod as PayoutMethod,
    previouslyAssignedMemberIds: [],
  });

  const created = await prisma.$transaction(async (tx) => {
    const cycle = await tx.cycle.create({
      data: {
        groupId,
        cycleNumber,
        status: CycleStatus.open,
      },
    });
    for (const r of plan) {
      await tx.cycleRound.create({
        data: {
          cycleId: cycle.id,
          roundNumber: r.roundNumber,
          dueDate: r.dueDate,
          status: RoundStatus.pending,
          totalCollectedNgwe: 0n,
        },
      });
    }
    for (const r of plan) {
      if (r.recipientMemberIds.length === 0) continue;
      const round = await tx.cycleRound.findUniqueOrThrow({
        where: { cycleId_roundNumber: { cycleId: cycle.id, roundNumber: r.roundNumber } },
      });
      for (const memberId of r.recipientMemberIds) {
        await tx.cyclePayout.create({
          data: { roundId: round.id, memberId, amountNgwe: 0n },
        });
      }
    }
    return { cycleId: cycle.id, cycleNumber };
  });

  if (opts.notify) {
    notifyGroup(groupId, `Cycle #${created.cycleNumber} is now open. The owner can start it when ready.`);
  }

  return loadCycle(created.cycleId);
}

/**
 * Start an open cycle. Sends a WhatsApp to all members.
 */
export async function startCycle(
  groupId: string,
  cycleId: string,
  requester: { id: string; role: GroupMemberRole },
): Promise<CycleWithRounds> {
  if (requester.role !== GroupMemberRole.owner) {
    throw new ForbiddenError('Only the group owner can start a cycle');
  }
  const cycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
  if (!cycle || cycle.groupId !== groupId) throw new NotFoundError('Cycle');
  if (cycle.status !== CycleStatus.open) {
    throw new ConflictError('CYCLE_NOT_OPEN' as never, 'Only open cycles can be started');
  }

  await prisma.cycle.update({
    where: { id: cycleId },
    data: { status: CycleStatus.in_progress, startedAt: new Date() },
  });

  // Notify all members.
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: true } } },
  });
  if (group) {
    const firstRound = await prisma.cycleRound.findFirst({
      where: { cycleId },
      orderBy: { roundNumber: 'asc' },
    });
    const dueDateStr = firstRound
      ? firstRound.dueDate.toISOString().slice(0, 10)
      : 'soon';
    const settings = await prisma.groupSetting.findUnique({ where: { groupId } });
    const frequency = (settings?.contributionFrequency ?? 'monthly') as ContributionFrequency;
    const monthLabel = firstRound
      ? formatRoundLabel(1, firstRound.dueDate, frequency)
      : 'Month 1';

    for (const m of group.members) {
      if (m.status !== 'active') continue;
      sendWhatsApp(
        m.user.phone,
        cycleStartedTemplate({
          firstName: m.user.firstName,
          groupName: group.name,
          cycleNumber: cycle.cycleNumber,
          dueDate: dueDateStr,
        }),
      ).catch((e) =>
        logger.warn({ err: e.message, memberId: m.userId }, 'cycle-started WhatsApp enqueue failed'),
      );
    }

    notifyGroup(
      groupId,
      `Cycle #${cycle.cycleNumber} has started.\nFirst contribution (${monthLabel}) due ${dueDateStr}.`,
    );
  }

  return loadCycle(cycleId);
}

/**
 * Force-complete a cycle. Used when winding down a group. The owner can
 * call this; in-progress rounds will be left as-is (so the history is
 * preserved).
 */
export async function completeCycle(
  groupId: string,
  cycleId: string,
  requester: { id: string; role: GroupMemberRole },
): Promise<Cycle> {
  if (requester.role !== GroupMemberRole.owner) {
    throw new ForbiddenError('Only the group owner can complete a cycle');
  }
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      group: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          settings: { select: { autoOpenNextCycle: true } },
        },
      },
    },
  });
  if (!cycle || cycle.groupId !== groupId) throw new NotFoundError('Cycle');
  if (cycle.status === CycleStatus.completed) return cycle;

  const updated = await prisma.cycle.update({
    where: { id: cycleId },
    data: { status: CycleStatus.completed, completedAt: new Date() },
  });

  await notifyCycleCompleted(cycle);
  return updated;
}

export async function listCycles(
  groupId: string,
  _requester: { id: string; role: GroupMemberRole },
): Promise<Cycle[]> {
  return prisma.cycle.findMany({
    where: { groupId },
    orderBy: { cycleNumber: 'desc' },
  });
}

export async function getCycle(
  groupId: string,
  cycleId: string,
  _requester: { id: string; role: GroupMemberRole },
): Promise<CycleDetail> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      group: { select: { id: true, name: true, template: true } },
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: {
          contributions: { select: { id: true, memberId: true, status: true, paidDate: true } },
          payouts: {
            select: { id: true, memberId: true, amountNgwe: true, paidAt: true },
          },
        },
      },
    },
  });
  if (!cycle || cycle.groupId !== groupId) throw new NotFoundError('Cycle');

  // Collect recipient rows per round.
  const roundIds = cycle.rounds.map((r) => r.id);
  const recipients = await prisma.cyclePayout.findMany({
    where: { roundId: { in: roundIds } },
    select: { id: true, roundId: true, memberId: true },
  });
  const recipientsByRound = new Map<string, { id: string; memberId: string }[]>();
  for (const p of recipients) {
    if (!recipientsByRound.has(p.roundId)) recipientsByRound.set(p.roundId, []);
    recipientsByRound.get(p.roundId)!.push({ id: p.id, memberId: p.memberId });
  }

  return {
    ...cycle,
    rounds: cycle.rounds.map((r) => ({
      ...r,
      contributions: r.contributions.map((c) => ({
        ...c,
        paidDate: c.paidDate ? c.paidDate.toISOString() : null,
      })),
      payouts: r.payouts.map((p) => ({
        ...p,
        amountNgwe: p.amountNgwe,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      })),
      recipients: recipientsByRound.get(r.id) ?? [],
    })),
  } as unknown as CycleDetail;
}

/**
 * Internal helper: load a freshly-created/updated cycle + its rounds +
 * recipients. Reused by `openCycle` and `startCycle`.
 */
async function loadCycle(cycleId: string): Promise<CycleWithRounds> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      rounds: {
        orderBy: { roundNumber: 'asc' },
        include: { payouts: { select: { id: true, memberId: true } } },
      },
    },
  });
  if (!cycle) throw new NotFoundError('Cycle');
  return {
    ...cycle,
    rounds: cycle.rounds.map((r) => ({
      ...r,
      recipients: r.payouts.map((p) => ({ id: p.id, memberId: p.memberId })),
    })),
  };
}

type CycleCompletionContext = {
  id: string;
  cycleNumber: number;
  group: {
    id: string;
    ownerId: string;
    name: string;
    settings: { autoOpenNextCycle: boolean } | null;
  };
};

async function notifyCycleCompleted(cycle: CycleCompletionContext): Promise<void> {
  const owner = await prisma.user.findUnique({ where: { id: cycle.group.ownerId } });
  if (owner) {
    sendWhatsApp(
      owner.phone,
      `Hi ${owner.firstName}, your "${cycle.group.name}" cycle #${cycle.cycleNumber} has been completed. Open the next cycle from your dashboard.`,
    ).catch((e) =>
      logger.warn({ err: e.message, cycleId: cycle.id }, 'cycle-completed WhatsApp enqueue failed'),
    );
  }

  await notifyGroup(cycle.group.id, `Cycle #${cycle.cycleNumber} is complete.`);

  if (cycle.group.settings?.autoOpenNextCycle) {
    try {
      const next = await openCycleInternal(cycle.group.id, { notify: false });
      await notifyGroup(
        cycle.group.id,
        `Cycle #${next.cycleNumber} was opened automatically. The owner can start it when ready.`,
      );
    } catch (e) {
      logger.warn(
        { err: (e as Error).message, groupId: cycle.group.id, cycleId: cycle.id },
        'auto-open next cycle failed',
      );
    }
  }
}

/**
 * Called by contributions.service and payouts.service after a state
 * change. If all rounds in the cycle are `completed`, flip the cycle to
 * `completed` and notify the owner.
 */
export async function autoCompleteIfDone(cycleId: string): Promise<void> {
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    include: {
      rounds: { select: { status: true } },
      group: {
        select: {
          id: true,
          ownerId: true,
          name: true,
          settings: { select: { autoOpenNextCycle: true } },
        },
      },
    },
  });
  if (!cycle) return;
  if (cycle.status !== CycleStatus.in_progress) return;
  const allDone = cycle.rounds.length > 0 && cycle.rounds.every((r) => r.status === RoundStatus.completed);
  if (!allDone) return;

  await prisma.cycle.update({
    where: { id: cycleId },
    data: { status: CycleStatus.completed, completedAt: new Date() },
  });

  await notifyCycleCompleted(cycle);
}

// Re-export for use by contributions / payouts modules.
export type { GeneratedRound };
export { Prisma };
