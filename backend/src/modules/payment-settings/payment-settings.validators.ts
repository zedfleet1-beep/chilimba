/**
 * Zod validators for the payment-settings endpoints. All `.strict()`.
 *
 * Cross-field rule (enforced via .superRefine): the field set must be
 * consistent with `paymentMethod`:
 *   - mobile_money → mobileMoneyProvider required, bankName forbidden
 *   - bank        → bankName required, mobileMoneyProvider forbidden
 */
import { z } from 'zod';
import { phoneSchema } from '@/lib/zodCommon';
import { PaymentMethod, MobileMoneyProvider } from '@prisma/client';

const baseFields = {
  accountName: z.string().min(1).max(200),
  accountNumber: z.string().min(3).max(100),
  reference: z.string().max(500).optional(),
};

export const platformDefaultSchema = z
  .object({
    paymentMethod: z.nativeEnum(PaymentMethod),
    mobileMoneyProvider: z.nativeEnum(MobileMoneyProvider).optional(),
    bankName: z.string().min(1).max(200).optional(),
    ...baseFields,
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.paymentMethod === 'mobile_money') {
      if (!val.mobileMoneyProvider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mobileMoneyProvider'],
          message: 'mobileMoneyProvider is required when paymentMethod is mobile_money',
        });
      }
      if (val.bankName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankName'],
          message: 'bankName must not be set when paymentMethod is mobile_money',
        });
      }
    } else if (val.paymentMethod === 'bank') {
      if (!val.bankName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bankName'],
          message: 'bankName is required when paymentMethod is bank',
        });
      }
      if (val.mobileMoneyProvider) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mobileMoneyProvider'],
          message: 'mobileMoneyProvider must not be set when paymentMethod is bank',
        });
      }
    }
  });

export const invoiceOverrideSchema = platformDefaultSchema; // same shape

// Loose validator used by the customer-facing /effective endpoint.
export const effectiveQuerySchema = z
  .object({
    invoiceId: z.string().uuid(),
  })
  .strict();

export const platformAccountNumberSchema = phoneSchema;

export type PlatformDefaultInput = z.infer<typeof platformDefaultSchema>;
export type InvoiceOverrideInput = z.infer<typeof invoiceOverrideSchema>;
export type EffectiveQuery = z.infer<typeof effectiveQuerySchema>;
