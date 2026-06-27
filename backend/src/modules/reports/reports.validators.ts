import { z } from 'zod';

export const cycleReportQuerySchema = z
  .object({
    cycleId: z.string().uuid().optional(),
  })
  .strict();

export const memberStatementQuerySchema = z
  .object({
    memberId: z.string().uuid(),
    cycleId: z.string().uuid().optional(),
  })
  .strict();