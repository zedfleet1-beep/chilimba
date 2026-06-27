/**
 * WhatsApp template: a contribution is overdue. Sent by the late-detection
 * cron the day after `dueDate + gracePeriodDays`.
 */
export const contributionReminderTemplate = (params: {
  firstName: string;
  groupName: string;
  amount: string;
  dueDate: string; // ISO date
  latePenalty: string;
}): string =>
  `Hi ${params.firstName},

Your ${params.amount} contribution for "${params.groupName}" was due on ${params.dueDate} and is now late.

A late penalty of ${params.latePenalty} may be applied per the group's rules. Please pay as soon as possible to avoid further penalties.

— Chilimba`;
