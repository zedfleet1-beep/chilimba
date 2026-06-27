/**
 * Zod validators for the contributions module. All `.strict()`.
 *
 * The `upload` route is multipart/form-data; the file is captured by
 * multer in `req.file`. No JSON body validation is needed there.
 */
import { z } from 'zod';

export const memberParamsSchema = z
  .object({
    memberId: z.string().uuid(),
  })
  .strict();

export const rejectContributionSchema = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

export const recordContributionSchema = z
  .object({
    notes: z.string().max(500).optional(),
  })
  .strict();

export type MemberParams = z.infer<typeof memberParamsSchema>;
export type RejectContributionInput = z.infer<typeof rejectContributionSchema>;
