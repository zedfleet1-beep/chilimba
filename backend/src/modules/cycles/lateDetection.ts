/**
 * Late detection. Iterates all in-progress cycles, finds contributions
 * whose `dueDate + gracePeriodDays` has passed and status is still
 * `pending`, flips them to `late`, and sends a one-shot WhatsApp
 * reminder to the member.
 *
 * Two ways to run:
 *   - Daily cron (00:00 UTC) via `startLateDetectionWorker()`
 *   - Manual trigger via `POST /api/v1/admin/cycles/check-late` for testing
 */
import { Job } from 'bullmq';
import {
  ContributionStatus,
  CycleStatus,
  RoundStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendWhatsApp } from '@/lib/whatsapp';
import { logger } from '@/lib/logger';
import { startScheduledWorker } from '@/lib/queue';
import { formatNgwe } from '@/lib/money';
import { contributionReminderTemplate } from '@/modules/notifications/templates/contributionReminder';

export const LATE_DETECTION_QUEUE = 'late-detection';
const LATE_DETECTION_CRON = '0 0 * * *'; // every day at 00:00 UTC

export interface LateDetectionResult {
  scannedCycles: number;
  flippedToLate: number;
  whatsappSent: number;
  errors: number;
}

export async function runLateDetection(): Promise<LateDetectionResult> {
  const now = new Date();
  const result: LateDetectionResult = {
    scannedCycles: 0,
    flippedToLate: 0,
    whatsappSent: 0,
    errors: 0,
  };

  // All in-progress cycles, with their rounds + settings.
  const cycles = await prisma.cycle.findMany({
    where: { status: CycleStatus.in_progress },
    include: {
      group: {
        include: { settings: true, members: { where: { status: 'active' }, include: { user: true } } },
      },
      rounds: {
        where: { status: { in: [RoundStatus.pending, RoundStatus.collecting] } },
      },
    },
  });
  result.scannedCycles = cycles.length;

  for (const cycle of cycles) {
    const settings = cycle.group.settings;
    if (!settings) continue;
    const graceMs = settings.gracePeriodDays * 24 * 60 * 60 * 1000;
    for (const round of cycle.rounds) {
      const cutoffMs = round.dueDate.getTime() + graceMs;
      if (now.getTime() <= cutoffMs) continue;

      // Find pending contributions for this round.
      const late = await prisma.contribution.findMany({
        where: { cycleId: cycle.id, roundId: round.id, status: ContributionStatus.pending },
        include: { member: { include: { user: true } } },
      });

      for (const c of late) {
        try {
          await prisma.contribution.update({
            where: { id: c.id },
            data: { status: ContributionStatus.late },
          });
          result.flippedToLate++;

          // Send the reminder. (Best-effort; debounce per member/round/day
          // is a polish-round concern.)
          sendWhatsApp(
            c.member.user.phone,
            contributionReminderTemplate({
              firstName: c.member.user.firstName,
              groupName: cycle.group.name,
              amount: formatNgwe(c.amountNgwe),
              dueDate: round.dueDate.toISOString().slice(0, 10),
              latePenalty: formatNgwe(settings.latePenaltyNgwe),
            }),
          ).then(
            () => result.whatsappSent++,
            (e) => {
              result.errors++;
              logger.warn({ err: e.message, contributionId: c.id }, 'late-reminder WhatsApp failed');
            },
          );
        } catch (e) {
          result.errors++;
          logger.error({ err: (e as Error).message, contributionId: c.id }, 'late detection failed for contribution');
        }
      }
    }
  }

  logger.info(result, 'late detection run complete');
  return result;
}

/**
 * Start the BullMQ repeatable worker that runs `runLateDetection()`
 * daily at 00:00 UTC. Started from `server.ts` alongside the
 * notification worker.
 */
export function startLateDetectionWorker() {
  return startScheduledWorker<unknown>({
    queueName: LATE_DETECTION_QUEUE,
    cron: LATE_DETECTION_CRON,
    handler: async (_job: Job) => {
      await runLateDetection();
    },
  });
}
