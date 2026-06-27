/**
 * Zod validators for the cycles module. All `.strict()`.
 */
import { z } from 'zod';

export const cycleParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export type CycleParams = z.infer<typeof cycleParamsSchema>;

/**
 * Optional input for opening a cycle. The body is empty for now — the
 * start date is the moment the owner calls `startCycle`. We keep the
 * validator here so future options (e.g. `startDate`) are trivial to add.
 */
export const openCycleSchema = z.object({}).strict();
