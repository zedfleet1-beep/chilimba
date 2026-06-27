/**
 * Zod validators for payout routes. All `.strict()`.
 */
import { z } from 'zod';

export const rerollPayoutsSchema = z.object({}).strict();

export const assignPayoutRecipientsSchema = z
  .object({
    memberIds: z.array(z.string().uuid()).min(1).max(20),
  })
  .strict();
