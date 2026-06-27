/**
 * Payouts service. When a round is "collecting" (all contributions in),
 * the treasurer records payouts — one per recipient. The amount per
 * recipient is `roundTotalCollected / payoutRecipientsCount`.
 *
 * If `payoutMethod === 'random'` and the round hasn't been distributed
 * yet, the owner can re-roll the recipient draw.
 */
import {
  CyclePayout,
  GroupMemberRole,
  RoundStatus,
  PayoutMethod,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendWhatsApp } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import {
  isCloudinaryConfigured,
  uploadBufferToCloudinary,
} from '@/lib/cloudinary';
import { formatNgwe } from '@/lib/money';
import { payoutNotificationTemplate } from '@/modules/notifications/templates/payoutNotification';
import { autoCompleteIfDone } from '@/modules/cycles/cycles.service';
import { generateRounds } from '@/lib/cycleScheduler';
import { ContributionFrequency } from '@prisma/client';
import { notifyGroup } from '@/lib/groupWhatsApp';
import { formatRoundLabel } from '@/lib/roundLabels';

export interface RecordPayoutInput {
  groupId: string;
  cycleId: string;
  roundId: string;
  requester: { id: string; role: GroupMemberRole };
  /** Optional receipt POP for the payout (mobile money screenshot, etc.) */
  file?: { buffer: Buffer; mimetype: string; originalname?: string; size: number };
  notes?: string;
}

/**
 * Record that all pre-assigned payouts for a round have been paid.
 * Optionally uploads a receipt POP. For `queue` and `random`, the
 * recipient rows already exist (created at cycle open). For `manual`
 * (out of scope for v1) the owner would supply the recipient list
 * here.
 */
export async function recordPayout(input: RecordPayoutInput): Promise<{
  payouts: CyclePayout[];
  totalDistributedNgwe: bigint;
}> {
  const { groupId, cycleId, roundId, requester, file, notes } = input;
  if (requester.role !== GroupMemberRole.owner && requester.role !== GroupMemberRole.treasurer) {
    throw new ForbiddenError('Only the owner or treasurer can record a payout');
  }

  const round = await prisma.cycleRound.findUnique({
    where: { id: roundId },
    include: { cycle: { include: { group: { include: { settings: true, members: { where: { status: 'active' } } } } } } },
  });
  if (!round) throw new NotFoundError('Round');
  if (round.cycleId !== cycleId || round.cycle.groupId !== groupId) throw new NotFoundError('Round');

  const settings = round.cycle.group.settings;
  if (!settings) throw new ConflictError('NO_SETTINGS' as never, 'Group has no settings');

  // Recipients already exist for queue / random. For manual / voting
  // (out of scope) we'd accept them in the body.
  const existingPayouts = await prisma.cyclePayout.findMany({
    where: { roundId },
    include: { member: { include: { user: true } } },
  });
  if (existingPayouts.length === 0) {
    throw new ConflictError(
      'NO_RECIPIENTS' as never,
      'No recipients are pre-assigned for this round. Use rerollRandomPayouts or set the payout method to queue.',
    );
  }
  if (existingPayouts.some((p) => p.paidAt !== null)) {
    throw new ConflictError(
      'ALREADY_DISTRIBUTED' as never,
      'This round has already been distributed',
    );
  }

  // Distribute equally among the recipients.
  const perRecipient = round.totalCollectedNgwe / BigInt(existingPayouts.length);
  const perAmount = perRecipient > 0n ? perRecipient : settings.contributionAmountNgwe; // fallback: no contributions → use base

  // Optionally stream a single receipt POP to Cloudinary.
  let receiptUrl: string | null = null;
  let receiptKey: string | null = null;
  if (file) {
    if (!isCloudinaryConfigured()) {
      throw new ConflictError(
        'CLOUDINARY_NOT_CONFIGURED' as never,
        'File storage is not configured on the server.',
      );
    }
    const upload = await uploadBufferToCloudinary(file.buffer, {
      folder: 'chilimba/payouts',
    });
    receiptUrl = upload.secureUrl;
    receiptKey = upload.publicId;
  }

  // Mark all recipients as paid + send the WhatsApp.
  const updated = await prisma.$transaction(async (tx) => {
    const rows: CyclePayout[] = [];
    for (const p of existingPayouts) {
      const r = await tx.cyclePayout.update({
        where: { id: p.id },
        data: {
          amountNgwe: perAmount,
          paidAt: new Date(),
          proofKey: receiptKey,
          proofUrl: receiptUrl,
          notes: notes ?? null,
        },
      });
      rows.push(r);
    }
    return rows;
  });

  // Notify each recipient.
  for (const p of updated) {
    const original = existingPayouts.find((e) => e.id === p.id);
    if (!original) continue;
    sendWhatsApp(
      original.member.user.phone,
      payoutNotificationTemplate({
        firstName: original.member.user.firstName,
        groupName: round.cycle.group.name,
        amount: formatNgwe(perAmount),
        roundNumber: round.roundNumber,
      }),
    ).catch((e) =>
      logger.warn({ err: e.message, payoutId: p.id }, 'payout-notification WhatsApp failed'),
    );
  }

  // If this round's `totalCollectedNgwe` is still 0 (no contributions),
  // it means the round never collected. The treasurer is just closing
  // it. That's fine — mark it as paid_out and the cycle will auto-complete.
  await prisma.cycleRound.update({
    where: { id: roundId },
    data: { status: RoundStatus.completed },
  });
  await autoCompleteIfDone(cycleId);

  const recipientNames = existingPayouts
    .map((p) => `${p.member.user.firstName} ${p.member.user.lastName}`)
    .join(', ');
  const frequency = settings.contributionFrequency as ContributionFrequency;
  notifyGroup(
    groupId,
    `Payout recorded for ${formatRoundLabel(round.roundNumber, round.dueDate, frequency)}.\nRecipients: ${recipientNames}\nTotal: ${formatNgwe(perAmount * BigInt(updated.length))}`,
  );

  return { payouts: updated, totalDistributedNgwe: perAmount * BigInt(updated.length) };
}

/**
 * Owner assigns payout recipients for a round (manual payout method).
 * Replaces any unpaid recipient rows for the round.
 */
export async function assignPayoutRecipients(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberIds: string[],
  requester: { id: string; role: GroupMemberRole },
): Promise<CyclePayout[]> {
  if (requester.role !== GroupMemberRole.owner) {
    throw new ForbiddenError('Only the owner can assign payout recipients');
  }

  const round = await prisma.cycleRound.findUnique({
    where: { id: roundId },
    include: {
      cycle: {
        include: {
          group: {
            include: {
              settings: true,
              members: { where: { status: 'active' } },
            },
          },
        },
      },
    },
  });
  if (!round) throw new NotFoundError('Round');
  if (round.cycleId !== cycleId || round.cycle.groupId !== groupId) throw new NotFoundError('Round');

  const settings = round.cycle.group.settings;
  if (!settings) throw new ConflictError('NO_SETTINGS' as never, 'Group has no settings');
  if (settings.payoutMethod !== PayoutMethod.manual) {
    throw new ConflictError(
      'NOT_MANUAL' as never,
      'Manual recipient assignment is only available when payout method is manual',
    );
  }

  const expectedCount = settings.payoutRecipientsCount;
  if (memberIds.length !== expectedCount) {
    throw new ConflictError(
      'WRONG_COUNT' as never,
      `Select exactly ${expectedCount} recipient${expectedCount === 1 ? '' : 's'}`,
    );
  }
  if (new Set(memberIds).size !== memberIds.length) {
    throw new ConflictError('DUPLICATE_RECIPIENT' as never, 'Each recipient can only be selected once');
  }

  const activeIds = new Set(round.cycle.group.members.map((m) => m.id));
  for (const id of memberIds) {
    if (!activeIds.has(id)) {
      throw new ConflictError('INVALID_MEMBER' as never, 'All recipients must be active group members');
    }
  }

  const existingPayouts = await prisma.cyclePayout.findMany({ where: { roundId } });
  if (existingPayouts.some((p) => p.paidAt !== null)) {
    throw new ConflictError(
      'ALREADY_DISTRIBUTED' as never,
      'Cannot change recipients after payout has been recorded',
    );
  }

  const earlierRounds = await prisma.cycleRound.findMany({
    where: { cycleId, roundNumber: { lt: round.roundNumber } },
    select: { id: true },
  });
  const earlierPaid = await prisma.cyclePayout.findMany({
    where: {
      roundId: { in: earlierRounds.map((r) => r.id) },
      paidAt: { not: null },
    },
    select: { memberId: true },
  });
  const alreadyReceived = new Set(earlierPaid.map((p) => p.memberId));
  for (const id of memberIds) {
    if (alreadyReceived.has(id)) {
      throw new ConflictError(
        'ALREADY_RECEIVED' as never,
        'One or more selected members already received a payout this cycle',
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.cyclePayout.deleteMany({ where: { roundId } });
    for (const memberId of memberIds) {
      await tx.cyclePayout.create({
        data: { roundId, memberId, amountNgwe: 0n },
      });
    }
  });

  const assigned = await prisma.cyclePayout.findMany({
    where: { roundId },
    include: {
      member: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } },
    },
    orderBy: { id: 'asc' },
  });

  const names = assigned.map((p) => `${p.member.user.firstName} ${p.member.user.lastName}`).join(', ');
  const frequency = settings.contributionFrequency as ContributionFrequency;
  notifyGroup(
    groupId,
    `Payout recipients set for ${formatRoundLabel(round.roundNumber, round.dueDate, frequency)}: ${names}`,
  );

  return assigned;
}

/**
 * Re-roll the recipient draw for a `random`-payout-method round. Only
 * the owner can call this. Deletes the existing unpaid payouts and
 * generates a fresh draw.
 */
export async function rerollRandomPayouts(
  groupId: string,
  cycleId: string,
  roundId: string,
  requester: { id: string; role: GroupMemberRole },
): Promise<CyclePayout[]> {
  if (requester.role !== GroupMemberRole.owner) {
    throw new ForbiddenError('Only the owner can re-roll the recipient draw');
  }
  const round = await prisma.cycleRound.findUnique({
    where: { id: roundId },
    include: { cycle: { include: { group: { include: { settings: true, members: { where: { status: 'active' } } } } } } },
  });
  if (!round) throw new NotFoundError('Round');
  if (round.cycleId !== cycleId || round.cycle.groupId !== groupId) throw new NotFoundError('Round');
  if (round.cycle.group.settings?.payoutMethod !== PayoutMethod.random) {
    throw new ConflictError(
      'NOT_RANDOM' as never,
      'Re-rolling is only available when payoutMethod is random',
    );
  }

  const existingPayouts = await prisma.cyclePayout.findMany({ where: { roundId } });
  if (existingPayouts.some((p) => p.paidAt !== null)) {
    throw new ConflictError(
      'ALREADY_DISTRIBUTED' as never,
      'Cannot re-roll a round that has already been distributed',
    );
  }

  // Compute the set of memberIds that have ALREADY been assigned a
  // payout in earlier rounds of this cycle.
  const earlierRounds = await prisma.cycleRound.findMany({
    where: { cycleId, roundNumber: { lt: round.roundNumber } },
    select: { id: true },
  });
  const earlierPayouts = await prisma.cyclePayout.findMany({
    where: { roundId: { in: earlierRounds.map((r) => r.id) } },
    select: { memberId: true },
  });
  const previouslyAssigned = earlierPayouts.map((p) => p.memberId);

  // Re-generate the recipient draw for ALL rounds (so the schedule stays
  // consistent), then write only this round's recipients. (We only
  // overwrite the unpaid rows for THIS round.)
  const plan = generateRounds({
    members: round.cycle.group.members,
    payoutRecipientsCount: round.cycle.group.settings!.payoutRecipientsCount,
    frequency: round.cycle.group.settings!.contributionFrequency as ContributionFrequency,
    startDate: new Date(),
    payoutMethod: PayoutMethod.random,
    previouslyAssignedMemberIds: previouslyAssigned,
  });
  const thisRound = plan.find((p) => p.roundNumber === round.roundNumber);
  if (!thisRound) {
    throw new ConflictError(
      'NO_RECIPIENTS' as never,
      'Could not generate recipients for this round',
    );
  }

  // Delete + recreate the unpaid rows for this round.
  await prisma.$transaction(async (tx) => {
    await tx.cyclePayout.deleteMany({ where: { roundId, paidAt: null } });
    for (const memberId of thisRound.recipientMemberIds) {
      await tx.cyclePayout.create({
        data: { roundId, memberId, amountNgwe: 0n },
      });
    }
  });

  return prisma.cyclePayout.findMany({ where: { roundId } });
}

export async function listPayouts(
  groupId: string,
  cycleId: string,
  roundId: string,
  _requester: { id: string; role: GroupMemberRole },
) {
  const round = await prisma.cycleRound.findUnique({
    where: { id: roundId },
    include: { cycle: true },
  });
  if (!round) throw new NotFoundError('Round');
  if (round.cycleId !== cycleId || round.cycle.groupId !== groupId) throw new NotFoundError('Round');
  return prisma.cyclePayout.findMany({
    where: { roundId },
    include: { member: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } } },
    orderBy: { id: 'asc' },
  });
}
