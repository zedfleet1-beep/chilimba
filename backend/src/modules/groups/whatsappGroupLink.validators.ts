import { z } from 'zod';

export const sendWhatsappGroupVerificationSchema = z
  .object({
    jid: z.string().min(10).max(100),
    subject: z.string().max(200).optional(),
  })
  .strict();

export const verifyWhatsappGroupLinkSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your WhatsApp group'),
  })
  .strict();