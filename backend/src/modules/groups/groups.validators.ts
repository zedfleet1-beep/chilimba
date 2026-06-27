/**
 * Zod validators for groups + members. All `.strict()`.
 */
import { z } from 'zod';
import { phoneSchema, bigintFromNumberish } from '@/lib/zodCommon';
import {
  ContributionFrequency,
  GroupTemplate,
  GroupMemberRole,
  PayoutMethod,
} from '@prisma/client';

export const createGroupSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    template: z.nativeEnum(GroupTemplate),
    country: z.string().length(2).default('ZM'),
    currency: z.string().length(3).default('ZMW'),
  })
  .strict();

/**
 * All fields optional. BigInt fields accept either a numeric string
 * ("50000") or a non-negative integer (50000) and are cast to BigInt
 * inside the service. Decimal ratios stay as `number` (NOT BigInt —
 * they're ratios, not money).
 */
export const updateGroupSettingsSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    maxMembers: z.number().int().min(2).max(200).optional(),
    contributionAmountNgwe: bigintFromNumberish.optional(),
    contributionFrequency: z.nativeEnum(ContributionFrequency).optional(),
    gracePeriodDays: z.number().int().min(0).max(60).optional(),
    latePenaltyNgwe: bigintFromNumberish.optional(),
    payoutRecipientsCount: z.number().int().min(0).max(20).optional(),
    payoutMethod: z.nativeEnum(PayoutMethod).optional(),
    allowLoans: z.boolean().optional(),
    maxLoanMultiplier: z.number().min(0).max(10).optional(),
    loanInterestRate: z.number().min(0).max(1).optional(),
    absencePenaltyNgwe: bigintFromNumberish.optional(),
    exitPenaltyPercent: z.number().min(0).max(1).optional(),
    whatsappReminders: z.boolean().optional(),
    reminderDaysBefore: z.number().int().min(0).max(30).optional(),
    autoOpenNextCycle: z.boolean().optional(),
  })
  .strict();

export const addMemberSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: phoneSchema,
    role: z.nativeEnum(GroupMemberRole).optional(),
    payoutPosition: z.number().int().min(1).max(200).optional(),
    skipInvite: z.boolean().optional(),
  })
  .strict();

export const updateMemberSchema = z
  .object({
    role: z.nativeEnum(GroupMemberRole).optional(),
    payoutPosition: z.number().int().min(1).max(200).optional(),
  })
  .strict();

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupSettingsInput = z.infer<typeof updateGroupSettingsSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
