/**
 * WhatsApp template: a new cycle has started.
 */
export const cycleStartedTemplate = (params: {
  firstName: string;
  groupName: string;
  cycleNumber: number;
  dueDate: string; // ISO date (yyyy-mm-dd)
}): string =>
  `Hi ${params.firstName},

Cycle #${params.cycleNumber} of "${params.groupName}" has started. The first round's contribution is due on ${params.dueDate}.

Sign in to your dashboard to view the schedule and your payout position.

— Chilimba`;
