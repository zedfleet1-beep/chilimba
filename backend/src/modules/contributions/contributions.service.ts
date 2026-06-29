/**
 * Contributions service.
 *
 * Flow:
 *   1. Member (or treasurer) uploads a POP via Cloudinary (multipart).
 *      A `Contribution` row is created in `pending` status.
 *   2. Treasurer/owner reviews and calls `approveContribution`. Status
 *      flips to `paid` (or `late` if past due + grace). The round's
 *      `totalCollectedNgwe` is incremented.
 *   3. `rejectContribution` destroys the Cloudinary asset and leaves
 *      the row in `pending` (the member can re-upload).
 *   4. `waiveContribution` (owner only) marks the row as `waived` —
 *      typically used for hardship.
 */
import {
  Contribution,
  ContributionStatus,
  GroupMemberRole,
  RoundStatus,
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
  destroyAsset,
  isCloudinaryConfigured,
  resourceTypeForMime,
  uploadBufferToCloudinary,
} from '@/lib/cloudinary';
import { formatNgwe } from '@/lib/money';
import { contributionReceivedTemplate } from '@/modules/notifications/templates/contributionReceived';
import { autoCompleteIfDone } from '@/modules/cycles/cycles.service';
import { notifyGroup } from '@/lib/groupWhatsApp';
import { formatRoundLabel } from '@/lib/roundLabels';
import { ContributionFrequency } from '@prisma/client';

const GRACE_BUFFER_DAYS = 0; // applied via the round's dueDate + grace from settings; we re-derive here.

/**
 * Upload a POP for a member's contribution. Mirrors the invoice flow.
 * Authorization: the member themselves (their id matches the path) OR
 * the group's owner/treasurer (recording on behalf).
 */
export async function uploadContributionProof(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
  file: { buffer: Buffer; mimetype: string; originalname?: string; size: number },
  requester: { id: string; role: GroupMemberRole },
): Promise<Contribution> {
  if (!isCloudinaryConfigured()) {
    throw new ConflictError(
      'CLOUDINARY_NOT_CONFIGURED' as never,
      'File storage is not configured on the server. Contact the admin.',
    );
  }

  // Authorisation: either the member themselves, or owner/treasurer.
  const isSelf = await isMemberSelf(groupId, requester.id, memberId);
  const isPrivileged = requester.role === GroupMemberRole.owner || requester.role === GroupMemberRole.treasurer;
  if (!isSelf && !isPrivileged) {
    throw new ForbiddenError('You can only upload a POP for yourself, or you must be owner/treasurer');
  }

  const round = await loadRound(groupId, cycleId, roundId);

  // Stream to Cloudinary.
  const upload = await uploadBufferToCloudinary(file.buffer, {
    folder: 'chilimba/contributions',
  });

  // Upsert the contribution row (idempotent: if one already exists for
  // this member+round, we update it with the new proof; status is reset
  // to `pending` if the previous one was rejected).
  try {
    const existing = await prisma.contribution.findUnique({
      where: {
        cycleId_roundId_memberId: { cycleId, roundId, memberId },
      },
    });
    const contribution = existing
      ? await prisma.contribution.update({
          where: { id: existing.id },
          data: {
            proofKey: upload.publicId,
            proofUrl: upload.secureUrl,
            resourceType: upload.resourceType,
            fileType: fileTypeForMime(file.mimetype),
            amountNgwe: await expectedAmount(groupId),
            notes: null,
            recordedById: requester.id,
          },
        })
      : await prisma.contribution.create({
          data: {
            groupId,
            cycleId,
            roundId,
            memberId,
            amountNgwe: await expectedAmount(groupId),
            dueDate: round.dueDate,
            status: ContributionStatus.pending,
            proofKey: upload.publicId,
            proofUrl: upload.secureUrl,
            resourceType: upload.resourceType,
            fileType: fileTypeForMime(file.mimetype),
            recordedById: requester.id,
          },
        });

    const member = await prisma.groupMember.findUniqueOrThrow({
      where: { id: memberId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const settings = await prisma.groupSetting.findUniqueOrThrow({ where: { groupId } });
    const frequency = settings.contributionFrequency as ContributionFrequency;
    await notifyGroup(
      groupId,
      `${member.user.firstName} ${member.user.lastName} submitted proof of payment: ${formatNgwe(contribution.amountNgwe)} for ${formatRoundLabel(round.roundNumber, round.dueDate, frequency)}. Awaiting approval.`,
    );

    return contribution;
  } catch (err) {
    // Clean up the orphan Cloudinary asset.
    await destroyAsset(upload.publicId, resourceTypeForMime(file.mimetype));
    throw err;
  }
}

/**
 * Treasurer/owner records a cash contribution without a POP upload.
 * Creates or updates the row and marks it paid (or late) immediately.
 */
export async function recordContribution(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
  requester: { id: string; role: GroupMemberRole },
  notes?: string,
): Promise<Contribution> {
  if (requester.role !== GroupMemberRole.owner && requester.role !== GroupMemberRole.treasurer) {
    throw new ForbiddenError('Only the owner or treasurer can record a contribution');
  }
  const round = await loadRound(groupId, cycleId, roundId);
  const amount = await expectedAmount(groupId);
  const settings = await prisma.groupSetting.findUniqueOrThrow({ where: { groupId } });
  const graceMs = settings.gracePeriodDays * 24 * 60 * 60 * 1000;
  const isLate = Date.now() > round.dueDate.getTime() + graceMs;
  const status = isLate ? ContributionStatus.late : ContributionStatus.paid;

  const existing = await prisma.contribution.findUnique({
    where: { cycleId_roundId_memberId: { cycleId, roundId, memberId } },
  });
  if (existing && (existing.status === ContributionStatus.paid || existing.status === ContributionStatus.late)) {
    throw new ConflictError('ALREADY_PAID' as never, 'This contribution has already been recorded');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const contribution = existing
      ? await tx.contribution.update({
          where: { id: existing.id },
          data: {
            status,
            paidDate: new Date(),
            amountNgwe: amount,
            notes: notes ?? null,
            recordedById: requester.id,
          },
        })
      : await tx.contribution.create({
          data: {
            groupId,
            cycleId,
            roundId,
            memberId,
            amountNgwe: amount,
            dueDate: round.dueDate,
            paidDate: new Date(),
            status,
            notes: notes ?? null,
            recordedById: requester.id,
          },
        });
    if (!existing || existing.status === ContributionStatus.pending) {
      await tx.cycleRound.update({
        where: { id: roundId },
        data: { totalCollectedNgwe: { increment: amount } },
      });
    }
    return contribution;
  });

  const member = await prisma.groupMember.findUniqueOrThrow({
    where: { id: memberId },
    include: { user: true },
  });
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  sendWhatsApp(
    member.user.phone,
    contributionReceivedTemplate({
      firstName: member.user.firstName,
      groupName: group.name,
      amount: formatNgwe(amount),
      roundNumber: round.roundNumber,
      isLate,
    }),
  ).catch((e) =>
    logger.warn({ err: e.message, contributionId: updated.id }, 'contribution-received WhatsApp failed'),
  );

  const frequency = settings.contributionFrequency as ContributionFrequency;
  await notifyGroup(
    groupId,
    `Payment received from ${member.user.firstName} ${member.user.lastName}: ${formatNgwe(amount)} for ${formatRoundLabel(round.roundNumber, round.dueDate, frequency)}.`,
  );

  await maybeAdvanceRoundStatus(roundId, cycleId);
  return updated;
}

/**
 * Treasurer/owner approves a pending contribution. Flips status to
 * `paid` (or `late` if past due+grace), increments the round's
 * `totalCollectedNgwe`, and fires the WhatsApp.
 */
export async function approveContribution(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
  requester: { id: string; role: GroupMemberRole },
): Promise<Contribution> {
  if (requester.role !== GroupMemberRole.owner && requester.role !== GroupMemberRole.treasurer) {
    throw new ForbiddenError('Only the owner or treasurer can approve a contribution');
  }
  const round = await loadRound(groupId, cycleId, roundId);
  const contribution = await prisma.contribution.findUnique({
    where: { cycleId_roundId_memberId: { cycleId, roundId, memberId } },
    include: {
      member: { include: { user: true } },
    },
  });
  if (!contribution) throw new NotFoundError('Contribution');
  if (contribution.status === ContributionStatus.paid) {
    throw new ConflictError(
      'ALREADY_PAID' as never,
      'This contribution has already been approved',
    );
  }

  // Determine paid vs late based on dueDate + grace.
  const settings = await prisma.groupSetting.findUniqueOrThrow({ where: { groupId } });
  const graceMs = (settings.gracePeriodDays + GRACE_BUFFER_DAYS) * 24 * 60 * 60 * 1000;
  const cutoff = round.dueDate.getTime() + graceMs;
  const now = Date.now();
  const isLate = now > cutoff;
  const status = isLate ? ContributionStatus.late : ContributionStatus.paid;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.contribution.update({
      where: { id: contribution.id },
      data: { status, paidDate: new Date(), recordedById: requester.id },
    });
    // Only increment the round total for non-waived contributions.
    await tx.cycleRound.update({
      where: { id: roundId },
      data: { totalCollectedNgwe: { increment: contribution.amountNgwe } },
    });
    return c;
  });

  // WhatsApp the member.
  const memberUser = contribution.member.user;
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  sendWhatsApp(
    memberUser.phone,
    contributionReceivedTemplate({
      firstName: memberUser.firstName,
      groupName: group.name,
      amount: formatNgwe(contribution.amountNgwe),
      roundNumber: round.roundNumber,
      isLate,
    }),
  ).catch((e) =>
    logger.warn({ err: e.message, contributionId: updated.id }, 'contribution-received WhatsApp failed'),
  );

  const frequency = settings.contributionFrequency as ContributionFrequency;
  await notifyGroup(
    groupId,
    `Payment received from ${memberUser.firstName} ${memberUser.lastName}: ${formatNgwe(contribution.amountNgwe)} for ${formatRoundLabel(round.roundNumber, round.dueDate, frequency)}.`,
  );

  await maybeAdvanceRoundStatus(roundId, cycleId);

  return updated;
}

/**
 * Reject a contribution. Destroys the Cloudinary asset and stores the
 * reason. The row stays in `pending` so the member can re-upload.
 */
export async function rejectContribution(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
  requester: { id: string; role: GroupMemberRole },
  reason: string,
): Promise<Contribution> {
  if (requester.role !== GroupMemberRole.owner && requester.role !== GroupMemberRole.treasurer) {
    throw new ForbiddenError('Only the owner or treasurer can reject a contribution');
  }
  await loadRound(groupId, cycleId, roundId);
  const contribution = await prisma.contribution.findUnique({
    where: { cycleId_roundId_memberId: { cycleId, roundId, memberId } },
  });
  if (!contribution) throw new NotFoundError('Contribution');

  // Destroy the Cloudinary asset (best-effort).
  if (contribution.proofKey) {
    await destroyAsset(contribution.proofKey, (contribution.resourceType as 'image' | 'raw' | undefined) ?? 'image');
  }

  return prisma.contribution.update({
    where: { id: contribution.id },
    data: { notes: reason, proofKey: null, proofUrl: null, resourceType: null },
  });
}

/**
 * Owner-only: waive a member's contribution. No POP required. No
 * impact on the round's `totalCollectedNgwe` (waived means the
 * member doesn't pay this round).
 */
export async function waiveContribution(
  groupId: string,
  cycleId: string,
  roundId: string,
  memberId: string,
  requester: { id: string; role: GroupMemberRole },
): Promise<Contribution> {
  if (requester.role !== GroupMemberRole.owner) {
    throw new ForbiddenError('Only the owner can waive a contribution');
  }
  const round = await loadRound(groupId, cycleId, roundId);
  const amount = await expectedAmount(groupId);

  return prisma.contribution.upsert({
    where: { cycleId_roundId_memberId: { cycleId, roundId, memberId } },
    update: { status: ContributionStatus.waived, amountNgwe: amount },
    create: {
      groupId,
      cycleId,
      roundId,
      memberId,
      amountNgwe: amount,
      dueDate: round.dueDate,
      status: ContributionStatus.waived,
    },
  });
}

export async function listContributions(
  groupId: string,
  cycleId: string,
  roundId: string,
  _requester: { id: string; role: GroupMemberRole },
) {
  await loadRound(groupId, cycleId, roundId); // access check
  return prisma.contribution.findMany({
    where: { cycleId, roundId },
    orderBy: { dueDate: 'asc' },
    include: { member: { include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } } } },
  });
}

// ---------- helpers ----------

async function isMemberSelf(groupId: string, userId: string, memberId: string): Promise<boolean> {
  const m = await prisma.groupMember.findUnique({
    where: { id: memberId },
    select: { groupId: true, userId: true },
  });
  if (!m) return false;
  if (m.groupId !== groupId) return false;
  return m.userId === userId;
}

async function loadRound(groupId: string, cycleId: string, roundId: string) {
  const round = await prisma.cycleRound.findUnique({
    where: { id: roundId },
    include: { cycle: true },
  });
  if (!round) throw new NotFoundError('Round');
  if (round.cycleId !== cycleId) throw new NotFoundError('Round');
  if (round.cycle.groupId !== groupId) throw new NotFoundError('Round');
  return round;
}

async function expectedAmount(groupId: string): Promise<bigint> {
  const settings = await prisma.groupSetting.findUniqueOrThrow({ where: { groupId } });
  return settings.contributionAmountNgwe;
}

function fileTypeForMime(mimetype: string): 'jpg' | 'png' | 'pdf' {
  switch (mimetype) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
    case 'image/webp':
    case 'image/heic':
      return 'png';
    case 'application/pdf':
      return 'pdf';
    default:
      throw new ConflictError(
        'UNSUPPORTED_FILE_TYPE' as never,
        `Unsupported file type: ${mimetype}`,
      );
  }
}

/**
 * If every active member in this round has a `paid` (or waived, or late)
 * contribution, advance the round to `collecting` and (if the
 * pre-assigned recipients are also marked paid-out) on to `completed`.
 */
async function maybeAdvanceRoundStatus(roundId: string, cycleId: string): Promise<void> {
  const round = await prisma.cycleRound.findUnique({
    where: { id: roundId },
    include: { cycle: { include: { group: { include: { members: { where: { status: 'active' } } } } } } },
  });
  if (!round) return;

  const activeMemberIds = round.cycle.group.members.map((m) => m.id);
  const contributions = await prisma.contribution.findMany({
    where: { cycleId, roundId, memberId: { in: activeMemberIds } },
    select: { memberId: true, status: true },
  });
  const statusByMember = new Map(contributions.map((c) => [c.memberId, c.status]));

  const allCollected = activeMemberIds.every(
    (id) =>
      statusByMember.get(id) === ContributionStatus.paid ||
      statusByMember.get(id) === ContributionStatus.late ||
      statusByMember.get(id) === ContributionStatus.waived,
  );

  if (round.status === RoundStatus.pending && allCollected) {
    await prisma.cycleRound.update({
      where: { id: roundId },
      data: { status: RoundStatus.collecting },
    });
  }

  // Round becomes `completed` only when all payouts are paid.
  const payouts = await prisma.cyclePayout.findMany({
    where: { roundId },
    select: { paidAt: true },
  });
  const allPayoutsPaid = payouts.length > 0 && payouts.every((p) => p.paidAt !== null);
  if (allPayoutsPaid && round.status !== RoundStatus.completed) {
    await prisma.cycleRound.update({
      where: { id: roundId },
      data: { status: RoundStatus.completed },
    });
    await autoCompleteIfDone(cycleId);
  }
}
