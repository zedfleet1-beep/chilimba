/**
 * Group-member service. Add / list / update / remove.
 */
import { Prisma, GroupMember, GroupMemberRole, GroupMemberStatus, CycleStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { sendWhatsApp } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import {
  AddMemberInput,
  UpdateMemberInput,
} from './groups.validators';
import { notifyGroup } from '@/lib/groupWhatsApp';

/**
 * Add a member to a group. Re-uses an existing `User` row by phone, or
 * creates a `pending` one (otpVerified=false) and sends a WhatsApp invite.
 */
export async function addMember(
  groupId: string,
  requester: { id: string; role: GroupMemberRole },
  input: AddMemberInput,
): Promise<GroupMember> {
  if (requester.role !== GroupMemberRole.owner && requester.role !== GroupMemberRole.treasurer) {
    throw new ForbiddenError('Only owners and treasurers can add members');
  }
  const phone = normalizePhone(input.phone);
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { settings: true, members: { where: { status: 'active' } } },
  });
  if (!group) throw new NotFoundError('Group');
  if (group.settings && group.members.length >= group.settings.maxMembers) {
    throw new ConflictError('GROUP_FULL' as never, 'This group is at capacity');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Link or create the user.
    const existing = await tx.user.findUnique({ where: { phone } });
    let userId: string;
    if (existing) {
      userId = existing.id;
    } else {
      const placeholderHash = await bcrypt.hash(uuid(), 12);
      const created = await tx.user.create({
        data: {
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone,
          passwordHash: placeholderHash,
          otpVerified: false,
          role: 'member',
        },
      });
      userId = created.id;
    }

    // 2. Reject duplicate.
    const duplicate = await tx.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (duplicate && duplicate.status === GroupMemberStatus.active) {
      throw new ConflictError('ALREADY_A_MEMBER' as never, 'This person is already a member');
    }

    // 3. Auto-assign payout position if not provided.
    let payoutPosition = input.payoutPosition;
    if (payoutPosition === undefined) {
      const max = await tx.groupMember.aggregate({
        where: { groupId, status: 'active' },
        _max: { payoutPosition: true },
      });
      payoutPosition = (max._max.payoutPosition ?? 0) + 1;
    }

    // 4. Create the membership (or reactivate a soft-deleted one).
    const member = duplicate
      ? await tx.groupMember.update({
          where: { id: duplicate.id },
          data: {
            role: input.role ?? GroupMemberRole.member,
            payoutPosition,
            status: GroupMemberStatus.active,
            joinedAt: new Date(),
            exitedAt: null,
          },
        })
      : await tx.groupMember.create({
          data: {
            groupId,
            userId,
            role: input.role ?? GroupMemberRole.member,
            payoutPosition,
            status: GroupMemberStatus.active,
          },
        });

    return member;
  }).then(async (member) => {
    notifyGroup(
      groupId,
      `New member added: ${input.firstName.trim()} ${input.lastName.trim()} (${phone}).`,
    );

    // 5. Best-effort WhatsApp invite (only for new pending users).
    if (!input.skipInvite) {
      try {
        const u = await prisma.user.findUniqueOrThrow({ where: { id: member.userId } });
        if (!u.otpVerified) {
          await sendWhatsApp(
            phone,
            `Hi ${input.firstName}, you've been invited to join a Chilimba savings group. Sign up to get started: ${process.env.WEB_BASE_URL ?? 'http://localhost:5173'}/signup?phone=${encodeURIComponent(phone)}`,
          );
        }
      } catch (e) {
        logger.warn({ err: (e as Error).message, groupId, phone }, 'invite WhatsApp enqueue failed');
      }
    }
    return member;
  });
}

export async function listMembers(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundError('Group');
  return prisma.groupMember.findMany({
    where: { groupId, status: 'active' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
    orderBy: [{ payoutPosition: 'asc' }, { joinedAt: 'asc' }],
  });
}

/**
 * Update a member's role and/or payout position. Position swaps are
 * handled transactionally.
 */
export async function updateMember(
  groupId: string,
  memberId: string,
  requester: { id: string; role: GroupMemberRole },
  patch: UpdateMemberInput,
): Promise<GroupMember> {
  if (requester.role !== GroupMemberRole.owner) {
    throw new ForbiddenError('Only owners can update members');
  }
  const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!member || member.groupId !== groupId) throw new NotFoundError('Group member');

  if (member.role === GroupMemberRole.owner && patch.role && patch.role !== GroupMemberRole.owner) {
    throw new ConflictError('CANNOT_DEMOTE_OWNER' as never, 'Demote the owner by transferring ownership first');
  }

  if (patch.payoutPosition !== undefined && patch.payoutPosition !== member.payoutPosition) {
    return swapAndUpdate(groupId, memberId, patch.payoutPosition, patch);
  }

  const data: Prisma.GroupMemberUpdateInput = {};
  if (patch.role !== undefined) data.role = patch.role;
  return prisma.groupMember.update({ where: { id: memberId }, data });
}

async function swapAndUpdate(
  groupId: string,
  memberId: string,
  newPosition: number,
  patch: UpdateMemberInput,
): Promise<GroupMember> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.groupMember.findUniqueOrThrow({ where: { id: memberId } });
    const occupant = await tx.groupMember.findFirst({
      where: { groupId, payoutPosition: newPosition, NOT: { id: memberId } },
    });
    if (occupant) {
      await tx.groupMember.update({
        where: { id: occupant.id },
        data: { payoutPosition: current.payoutPosition },
      });
    }
    const data: Prisma.GroupMemberUpdateInput = { payoutPosition: newPosition };
    if (patch.role !== undefined) data.role = patch.role;
    return tx.groupMember.update({ where: { id: memberId }, data });
  });
}

/**
 * Remove a member (soft delete). Once a cycle is in progress, a member
 * can only exit after receiving their payout for that cycle.
 */
export async function removeMember(
  groupId: string,
  memberId: string,
  requester: { id: string; role: GroupMemberRole },
): Promise<GroupMember> {
  if (requester.role !== GroupMemberRole.owner) {
    throw new ForbiddenError('Only owners can remove members');
  }
  const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!member || member.groupId !== groupId) throw new NotFoundError('Group member');
  if (member.role === GroupMemberRole.owner) {
    throw new ConflictError('CANNOT_REMOVE_OWNER' as never, 'Transfer ownership before removing the owner');
  }

  const activeCycle = await prisma.cycle.findFirst({
    where: { groupId, status: CycleStatus.in_progress },
    select: { id: true },
  });
  if (activeCycle) {
    const paidPayout = await prisma.cyclePayout.findFirst({
      where: {
        memberId,
        paidAt: { not: null },
        round: { cycleId: activeCycle.id },
      },
      select: { id: true },
    });
    if (!paidPayout) {
      throw new ConflictError(
        'MEMBER_HAS_ACTIVE_CYCLE' as never,
        'This member can only be removed after receiving their payout for the active cycle.',
      );
    }
  }

  const removed = await prisma.groupMember.update({
    where: { id: memberId },
    data: { status: GroupMemberStatus.exited, exitedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { id: removed.userId },
    select: { firstName: true, lastName: true },
  });
  if (user) {
    notifyGroup(groupId, `Member removed: ${user.firstName} ${user.lastName}.`);
  }

  return removed;
}
