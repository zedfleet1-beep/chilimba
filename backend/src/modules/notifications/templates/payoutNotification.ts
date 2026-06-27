/**
 * WhatsApp template: a member is receiving a payout. Sent to the
 * recipient when the round is distributed.
 */
export const payoutNotificationTemplate = (params: {
  firstName: string;
  groupName: string;
  amount: string;
  roundNumber: number;
}): string =>
  `Hi ${params.firstName},

Congratulations! You're receiving ${params.amount} from "${params.groupName}" round ${params.roundNumber}.

The treasurer will send the funds to your registered mobile money number.

— Chilimba`;
