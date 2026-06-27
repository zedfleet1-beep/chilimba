/**
 * Plain-text WhatsApp message for the group-created notification.
 */
export const groupCreatedTemplate = (params: {
  name: string;
  groupName: string;
}): string =>
  `Hi ${params.name},

Your savings group "${params.groupName}" has been created! 🎉

Sign in to your Chilimba dashboard to invite members, set contribution amounts, and open your first cycle.

Welcome aboard.${`\n\n`}— Chilimba`;
