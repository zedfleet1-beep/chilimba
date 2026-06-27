/**
 * Zod validators for the payment-proofs endpoints. All `.strict()`.
 */
import { z } from 'zod';

export const approvePopSchema = z.object({}).strict();

export const rejectPopSchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

export type ApprovePopInput = z.infer<typeof approvePopSchema>;
export type RejectPopInput = z.infer<typeof rejectPopSchema>;
