import { z } from 'zod';
import { phoneSchema } from '@/lib/zodCommon';

export const listWhatsappLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  status: z.enum(['sent', 'delivered', 'read', 'failed']).optional(),
});

export const sendWhatsappSchema = z.object({
  phone: phoneSchema,
  message: z.string().trim().min(1).max(4000),
});