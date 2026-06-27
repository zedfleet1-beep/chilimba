/**
 * Pre-due contribution reminders. Runs daily and notifies members whose
 * round due date is exactly `reminderDaysBefore` days away (per group settings).
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
import { contributionDueSoonTemplate } from '@/modules/notifications/templates/contributionDueSoon';

export const CONTRIBUTION_REMINDER_QUEUE = 'contribution-reminders';
const REMINDER_CRON = '0 8 * * *'; // every day at 08:00 UTC

export interface ContributionReminderResult {
  scannedCycles: number;
  remindersSent: number;
  errors: number;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export async function runContributionReminders(): Promise<ContributionReminderResult> {
  const today = startOfUtcDay(new Date());
  const result: ContributionReminderResult = {
    scannedCycles: 0,
    remindersSent: 0,
    errors: 0,
  };

  const cycles = await prisma.cycle.findMany({
    where: { status: CycleStatus.in_progress },
    include: {
      group: {
        include: {
          settings: true,
          members: { where: { status: 'active' }, include: { user: true } },
        },
      },
      rounds: {
        where: { status: { in: [RoundStatus.pending, RoundStatus.collecting] } },
        orderBy: { roundNumber: 'asc' },
      },
    },
  });
  result.scannedCycles = cycles.length;

  for (const cycle of cycles) {
    const settings = cycle.group.settings;
    if (!settings?.whatsappReminders) continue;

    const activeRound = cycle.rounds[0];
    if (!activeRound) continue;

    const daysUntilDue = daysBetween(today, activeRound.dueDate);
    if (daysUntilDue !== settings.reminderDaysBefore) continue;

    const paidContributions = await prisma.contribution.findMany({
      where: {
        cycleId: cycle.id,
        roundId: activeRound.id,
        status: ContributionStatus.paid,
      },
      select: { memberId: true },
    });
    const paidMemberIds = new Set(paidContributions.map((c) => c.memberId));
    const targets = cycle.group.members.filter((m) => !paidMemberIds.has(m.id));

    for (const member of targets) {
      try {
        await sendWhatsApp(
          member.user.phone,
          contributionDueSoonTemplate({
            firstName: member.user.firstName,
            groupName: cycle.group.name,
            amount: formatNgwe(settings.contributionAmountNgwe),
            dueDate: activeRound.dueDate.toISOString().slice(0, 10),
            daysUntilDue,
          }),
        );
        result.remindersSent++;
      } catch (e) {
        result.errors++;
        logger.warn(
          { err: (e as Error).message, memberId: member.id, cycleId: cycle.id },
          'pre-due reminder WhatsApp failed',
        );
      }
    }
  }

  logger.info(result, 'contribution reminder run complete');
  return result;
}

export function startContributionReminderWorker() {
  return startScheduledWorker<unknown>({
    queueName: CONTRIBUTION_REMINDER_QUEUE,
    cron: REMINDER_CRON,
    handler: async (_job: Job) => {
      await runContributionReminders();
    },
  });
}