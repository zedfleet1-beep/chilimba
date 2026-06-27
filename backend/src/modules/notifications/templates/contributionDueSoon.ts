/**
 * WhatsApp template: contribution due soon. Sent by the pre-due reminder
 * cron `reminderDaysBefore` days before the round due date.
 */
export const contributionDueSoonTemplate = (params: {
  firstName: string;
  groupName: string;
  amount: string;
  dueDate: string;
  daysUntilDue: number;
}): string =>
  `Hi ${params.firstName},

Your ${params.amount} contribution for "${params.groupName}" is due on ${params.dueDate} (${params.daysUntilDue} day${params.daysUntilDue === 1 ? '' : 's'} from now).

Please pay on time to keep your group on track.

— Chilimba`;