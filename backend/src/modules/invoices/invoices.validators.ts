/**
 * Zod validators for the invoice endpoints. All schemas are `.strict()`.
 * Per AGENTS.md rule #10: unknown fields are rejected.
 *
 * POP upload (Week 4) is multipart/form-data; multer handles the file
 * and no JSON body validation is needed for that route.
 */
import { z } from 'zod';
import { phoneSchema } from '@/lib/zodCommon';
import { InvoiceStatus } from '@prisma/client';

export const createInvoiceSchema = z
  .object({
    customerName: z.string().min(1).max(200),
    phone: phoneSchema,
    email: z.string().email().max(255).optional(),
    amountNgwe: z.number().int().positive(),
    description: z.string().max(1000).optional(),
  })
  .strict();

export const listInvoicesQuerySchema = z
  .object({
    status: z.nativeEnum(InvoiceStatus).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    customerPhone: phoneSchema.optional(),
  })
  .strict();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;

