import { z } from 'zod';
import { bigintFromNumberish } from '@/lib/zodCommon';

export const requestLoanSchema = z
  .object({
    amountNgwe: bigintFromNumberish,
    purpose: z.string().max(500).optional(),
  })
  .strict();

export const rejectLoanSchema = z
  .object({
    reason: z.string().min(1).max(500).optional(),
  })
  .strict();

export const recordRepaymentSchema = z
  .object({
    amountNgwe: bigintFromNumberish,
    notes: z.string().max(500).optional(),
  })
  .strict();