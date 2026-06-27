/**
 * Super-admin operations: platform stats, group/user management, WhatsApp logs.
 */
import {
  GroupStatus,
  GroupMemberStatus,
  InvoiceStatus,
  PaymentProofStatus,
  UserStatus,
  WhatsappLogStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendWhatsApp } from '@/lib/whatsapp';
import { NotFoundError, ConflictError } from '@/lib/errors';

export interface AdminStats {
  activeGroups: number;
  totalMembers: number;
  pendingPopReviews: number;
  revenueThisMonthNgwe: string;
  whatsappSentToday: number;
  whatsappFailedRecent: number;
}

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getAdminStats(): Promise<AdminStats> {
  const monthStart = startOfMonthUtc();
  const todayStart = startOfTodayUtc();
  const recentFailedCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    activeGroups,
    totalMembers,
    pendingPopReviews,
    paidThisMonth,
    whatsappSentToday,
    whatsappFailedRecent,
  ] = await Promise.all([
    prisma.group.count({ where: { status: GroupStatus.active } }),
    prisma.groupMember.count({ where: { status: GroupMemberStatus.active } }),
    prisma.paymentProof.count({ where: { status: PaymentProofStatus.pending } }),
    prisma.invoice.aggregate({
      where: { status: InvoiceStatus.paid, paidAt: { gte: monthStart } },
      _sum: { amountNgwe: true },
    }),
    prisma.whatsappLog.count({
      where: { status: WhatsappLogStatus.sent, createdAt: { gte: todayStart } },
    }),
    prisma.whatsappLog.count({
      where: { status: WhatsappLogStatus.failed, createdAt: { gte: recentFailedCutoff } },
    }),
  ]);

  return {
    activeGroups,
    totalMembers,
    pendingPopReviews,
    revenueThisMonthNgwe: String(paidThisMonth._sum.amountNgwe ?? 0n),
    whatsappSentToday,
    whatsappFailedRecent,
  };
}

export async function listAdminGroups() {
  const groups = await prisma.group.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
      settings: { select: { contributionAmountNgwe: true, contributionFrequency: true } },
      _count: { select: { members: true, cycles: true } },
    },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    template: g.template,
    owner: g.owner,
    memberCount: g._count.members,
    cycleCount: g._count.cycles,
    settings: g.settings,
    createdAt: g.createdAt,
  }));
}

export async function suspendGroup(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundError('Group');
  if (group.status === GroupStatus.suspended) {
    throw new ConflictError('ALREADY_SUSPENDED' as never, 'This group is already suspended');
  }
  return prisma.group.update({
    where: { id: groupId },
    data: { status: GroupStatus.suspended },
  });
}

export async function reactivateGroup(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new NotFoundError('Group');
  if (group.status !== GroupStatus.suspended) {
    throw new ConflictError('NOT_SUSPENDED' as never, 'Only suspended groups can be reactivated');
  }
  return prisma.group.update({
    where: { id: groupId },
    data: { status: GroupStatus.active },
  });
}

export async function listAdminUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      role: true,
      status: true,
      otpVerified: true,
      createdAt: true,
      _count: { select: { groupMembers: true } },
    },
  });
  return users.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    email: u.email,
    role: u.role,
    status: u.status,
    otpVerified: u.otpVerified,
    groupCount: u._count.groupMembers,
    createdAt: u.createdAt,
  }));
}

export async function suspendUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  if (user.role === 'super_admin') {
    throw new ConflictError('CANNOT_SUSPEND_ADMIN' as never, 'Super admin accounts cannot be suspended');
  }
  if (user.status === UserStatus.suspended) {
    throw new ConflictError('ALREADY_SUSPENDED' as never, 'This user is already suspended');
  }
  return prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.suspended },
  });
}

export async function listWhatsappLogs(query: { limit: number; status?: WhatsappLogStatus }) {
  return prisma.whatsappLog.findMany({
    where: query.status ? { status: query.status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: query.limit,
    select: {
      id: true,
      toPhone: true,
      message: true,
      status: true,
      attempts: true,
      errorMessage: true,
      createdAt: true,
    },
  });
}

export async function sendManualWhatsapp(input: { phone: string; message: string }) {
  await sendWhatsApp(input.phone, input.message);
  return { sent: true };
}