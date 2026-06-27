/**
 * Plain-text WhatsApp message templates for the invoice + POP flow.
 * Co-located with the modules that use them per
 * docs/product-specs/whatsapp-notifications.md.
 *
 * Convention: each template is a pure function of the data it needs.
 * The service layer is responsible for normalizing phone numbers and
 * providing the WEB_BASE_URL.
 */
import { formatNgwe } from '@/lib/money';

const SIGN_OFF = '\n\n— Chilimba';

export const invoiceCreatedTemplate = (params: {
  name: string;
  invoiceNumber: string;
  amountNgwe: bigint;
  description?: string | null;
  webBaseUrl: string;
}): string =>
  `Hi ${params.name},

Your Chilimba invoice ${params.invoiceNumber} is ready.
Amount: ${formatNgwe(params.amountNgwe)}${
    params.description ? `\nFor: ${params.description}` : ''
  }

To activate your account, please pay via mobile money to the details on the invoice, then upload your proof of payment at:

${params.webBaseUrl}/invoices

We'll confirm your payment and send you a link to create your savings group.${SIGN_OFF}`;

export const popApprovedTemplate = (params: {
  name: string;
  invoiceNumber: string;
  groupCreationLink: string;
}): string =>
  `Hi ${params.name},

Your payment for invoice ${params.invoiceNumber} has been confirmed! 🎉

You're now ready to create your savings group. Click the link below — it expires in 48 hours:

${params.groupCreationLink}

Welcome to Chilimba.${SIGN_OFF}`;

export const popRejectedTemplate = (params: {
  name: string;
  invoiceNumber: string;
  reason: string;
  webBaseUrl: string;
}): string =>
  `Hi ${params.name},

We couldn't verify the proof of payment you uploaded for invoice ${params.invoiceNumber}.

Reason: ${params.reason}

Please upload a clearer image or the correct receipt from your dashboard:

${params.webBaseUrl}/invoices${SIGN_OFF}`;
