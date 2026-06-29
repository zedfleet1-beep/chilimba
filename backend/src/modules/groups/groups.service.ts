/**
 * Group service. Pure business logic — no req/res, no Prisma in routes.
 *
 * The `createGroupFromToken` flow is the one the Week 3-4 happy path hinges
 * on: a customer opens a signed WhatsApp link, supplies a few details, and
 * the backend creates the Group, GroupSetting (with template defaults), and
 * owner GroupMember in a single transaction.
 */
import { Prisma, Group, GroupSetting, GroupMember, GroupTemplate, GroupMemberRole, InvoiceStatus } from '@prisma/client';
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
import { groupCreatedTemplate } from './templates/group-created.template';
import {
  CreateGroupInput,
  UpdateGroupSettingsInput,
} from './groups.validators';

export interface CreateGroupResult {
  group: Group;
  owner: GroupMember;
  ownerUser: { id: string; firstName: string; lastName: string; phone: string };
}

/**
 * Create a group from a 48h signed token. The customer may not yet be a
 * registered user — we upsert one by phone first.
 */
export async function createGroupFromToken(
  tokenPayload: { invoiceId: string; phone: string },
  input: CreateGroupInput,
): Promise<CreateGroupResult> {
  const phone = normalizePhone(tokenPayload.phone);

  const invoice = await prisma.invoice.findUnique({
    where: { id: tokenPayload.invoiceId },
    include: { group: true },
  });
  if (!invoice) throw new NotFoundError('Invoice');
  if (invoice.status !== InvoiceStatus.paid) {
    throw new ConflictError(
      'INVOICE_NOT_PAID' as never,
      'A group can only be created from a paid invoice',
    );
  }
  if (invoice.group) {
    throw new ConflictError(
      'INVOICE_ALREADY_LINKED' as never,
      'This invoice already has a group linked to it',
    );
  }
  if (invoice.phone !== phone) {
    throw new ForbiddenError('This token does not match the invoice phone number');
  }

  // 1. Upsert the customer user.
  const ownerUser = await upsertCustomerUser(phone);

  // 2. Create Group + GroupSetting + GroupMember in a transaction.
  const templateDefaults = applyTemplateDefaults(input.template);

  const { group, owner } = await prisma.$transaction(async (tx) => {
    const newGroup = await tx.group.create({
      data: {
        name: input.name.trim(),
        description: input.description ?? null,
        invoiceId: invoice.id,
        ownerId: ownerUser.id,
        template: input.template,
        country: input.country ?? 'ZM',
        currency: input.currency ?? 'ZMW',
      },
    });
    await tx.groupSetting.create({
      data: {
        groupId: newGroup.id,
        ...templateDefaults,
        contributionAmountNgwe: BigInt(templateDefaults.contributionAmountNgwe),
      },
    });
    const ownerMember = await tx.groupMember.create({
      data: {
        groupId: newGroup.id,
        userId: ownerUser.id,
        role: GroupMemberRole.owner,
        payoutPosition: 1,
        status: 'active',
      },
    });
    return { group: newGroup, owner: ownerMember };
  });

  // 3. Best-effort welcome WhatsApp.
  sendWhatsApp(
    phone,
    groupCreatedTemplate({ name: ownerUser.firstName, groupName: group.name }),
  ).catch((e) =>
    logger.warn({ err: e.message, groupId: group.id }, 'group-created WhatsApp enqueue failed'),
  );

  return {
    group,
    owner,
    ownerUser: {
      id: ownerUser.id,
      firstName: ownerUser.firstName,
      lastName: ownerUser.lastName,
      phone: ownerUser.phone,
    },
  };
}

/**
 * Idempotent upsert of a customer user by phone. Uses a placeholder
 * password (the customer must reset it on first sign-in via /auth/forgot).
 */
async function upsertCustomerUser(phone: string) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return existing;
  // Random password — they will use /auth/forgot to set their own.
  const placeholderHash = await bcrypt.hash(uuid(), 12);
  return prisma.user.create({
    data: {
      firstName: 'Chilimba',
      lastName: 'Customer',
      phone,
      passwordHash: placeholderHash,
      otpVerified: false, // they need to verify before login
      role: 'member',
    },
  });
}

/**
 * Static template defaults from docs/product-specs/group-creation.md.
 * `contributionAmountNgwe` is left as a string here and converted to BigInt
 * just before insert.
 */
export function applyTemplateDefaults(
  template: GroupTemplate,
): {
  maxMembers: number;
  contributionAmountNgwe: string; // BigInt at insert time
  payoutRecipientsCount: number;
  allowLoans: boolean;
  loanInterestRate: number;
} {
  switch (template) {
    case GroupTemplate.rotating_cash:
      return {
        maxMembers: 20,
        contributionAmountNgwe: '100000', // K1,000 placeholder — owner can edit
        payoutRecipientsCount: 2,
        allowLoans: false,
        loanInterestRate: 0.2,
      };
    case GroupTemplate.grocery:
      return {
        maxMembers: 20,
        contributionAmountNgwe: '100000',
        payoutRecipientsCount: 1,
        allowLoans: true,
        loanInterestRate: 0.2,
      };
    case GroupTemplate.custom:
    default:
      return {
        maxMembers: 10,
        contributionAmountNgwe: '50000',
        payoutRecipientsCount: 1,
        allowLoans: false,
        loanInterestRate: 0.2,
      };
  }
}

/**
 * List groups the caller is a member of (any active role).
 */
export async function listMyGroups(userId: string): Promise<
  Array<Group & { settings: GroupSetting | null; memberCount: number; myRole: GroupMemberRole }>
> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, status: 'active' },
    include: {
      group: { include: { settings: true, members: { where: { status: 'active' } } } },
    },
    orderBy: { joinedAt: 'desc' },
  });
  return memberships.map((m) => ({
    ...m.group,
    myRole: m.role,
    memberCount: m.group.members.length,
  }));
}

/**
 * Single group detail, with settings + members (slim).
 */
export async function getGroup(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      settings: true,
      members: {
        where: { status: 'active' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { payoutPosition: 'asc' },
      },
    },
  });
  if (!group) throw new NotFoundError('Group');
  return group;
}

/**
 * Update group settings. If a cycle is in_progress, reject changes to
 * fields that would alter the cycle's number of rounds or the
 * contribution amount. The other fields (name, description,
 * gracePeriodDays, latePenaltyNgwe, whatsappReminders, etc.) are
 * always editable.
 */
export async function updateGroupSettings(
  groupId: string,
  patch: UpdateGroupSettingsInput,
): Promise<GroupSetting> {
  const existing = await prisma.groupSetting.findUnique({ where: { groupId } });
  if (!existing) throw new NotFoundError('Group settings');

  // Refuse cycle-altering changes mid-cycle.
  const inProgress = await prisma.cycle.findFirst({
    where: { groupId, status: { in: ['open', 'in_progress'] } },
  });
  if (inProgress) {
    const locked: string[] = [];
    if (patch.maxMembers !== undefined && patch.maxMembers !== existing.maxMembers) {
      locked.push('maxMembers');
    }
    if (patch.contributionAmountNgwe !== undefined) {
      locked.push('contributionAmountNgwe');
    }
    if (patch.contributionFrequency !== undefined) {
      locked.push('contributionFrequency');
    }
    if (patch.payoutRecipientsCount !== undefined && patch.payoutRecipientsCount !== existing.payoutRecipientsCount) {
      locked.push('payoutRecipientsCount');
    }
    if (patch.payoutMethod !== undefined && patch.payoutMethod !== existing.payoutMethod) {
      locked.push('payoutMethod');
    }
    if (locked.length > 0) {
      throw new ConflictError(
        'CYCLE_IN_PROGRESS' as never,
        `Cannot change ${locked.join(', ')} while a cycle is in progress. Complete the current cycle first.`,
      );
    }
  }

  const data: Prisma.GroupSettingUpdateInput = {};
  if (patch.name !== undefined) {
    await prisma.group.update({ where: { id: groupId }, data: { name: patch.name } });
  }
  if (patch.description !== undefined) {
    await prisma.group.update({ where: { id: groupId }, data: { description: patch.description } });
  }
  if (patch.maxMembers !== undefined) data.maxMembers = patch.maxMembers;
  if (patch.contributionAmountNgwe !== undefined) {
    data.contributionAmountNgwe = BigInt(patch.contributionAmountNgwe);
  }
  if (patch.contributionFrequency !== undefined) data.contributionFrequency = patch.contributionFrequency;
  if (patch.gracePeriodDays !== undefined) data.gracePeriodDays = patch.gracePeriodDays;
  if (patch.latePenaltyNgwe !== undefined) data.latePenaltyNgwe = BigInt(patch.latePenaltyNgwe);
  if (patch.payoutRecipientsCount !== undefined) data.payoutRecipientsCount = patch.payoutRecipientsCount;
  if (patch.payoutMethod !== undefined) data.payoutMethod = patch.payoutMethod;
  if (patch.allowLoans !== undefined) data.allowLoans = patch.allowLoans;
  if (patch.maxLoanMultiplier !== undefined) data.maxLoanMultiplier = patch.maxLoanMultiplier;
  if (patch.loanInterestRate !== undefined) data.loanInterestRate = patch.loanInterestRate;
  if (patch.absencePenaltyNgwe !== undefined) data.absencePenaltyNgwe = BigInt(patch.absencePenaltyNgwe);
  if (patch.exitPenaltyPercent !== undefined) data.exitPenaltyPercent = patch.exitPenaltyPercent;
  if (patch.whatsappReminders !== undefined) data.whatsappReminders = patch.whatsappReminders;
  if (patch.reminderDaysBefore !== undefined) data.reminderDaysBefore = patch.reminderDaysBefore;
  if (patch.autoOpenNextCycle !== undefined) data.autoOpenNextCycle = patch.autoOpenNextCycle;

  if (Object.keys(data).length === 0) return existing;

  return prisma.groupSetting.update({ where: { groupId }, data });
}

/**
 * Look up the group for a signed group-creation token. Used by
 * `GET /api/v1/groups/lookup-by-token` (a small UX helper for the
 * /create-group page that wants to preview the group name).
 */
export async function getInvoiceForToken(tokenPayload: {
  invoiceId: string;
  phone: string;
}) {
  const phone = normalizePhone(tokenPayload.phone);
  const invoice = await prisma.invoice.findUnique({
    where: { id: tokenPayload.invoiceId },
    include: { group: true },
  });
  if (!invoice) throw new NotFoundError('Invoice');
  if (invoice.phone !== phone) {
    throw new ForbiddenError('Token does not match invoice');
  }
  return invoice;
}
