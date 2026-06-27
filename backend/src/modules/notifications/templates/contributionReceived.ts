/**
 * WhatsApp template: a contribution was received and recorded. Sent to
 * the member when the treasurer/owner approves their POP.
 */
export const contributionReceivedTemplate = (params: {
  firstName: string;
  groupName: string;
  amount: string;
  roundNumber: number;
  isLate: boolean;
}): string =>
  `Hi ${params.firstName},

Your ${params.amount} contribution for "${params.groupName}" round ${params.roundNumber} has been received.${params.isLate ? ' It was recorded as late — a penalty may be applied per the group rules.' : ''}

Thanks for keeping the circle going!

— Chilimba`;
