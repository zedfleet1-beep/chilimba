/**
 * Zod validators for the auth endpoints. All schemas are strict
 * (unknown fields are rejected).
 */
import { z } from 'zod';
import { phoneSchema } from '@/lib/zodCommon';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain at least one uppercase letter')
  .refine((v) => /\d/.test(v), 'Password must contain at least one number');

export const signupSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: phoneSchema,
    email: z.string().email().max(255).optional(),
    password: passwordSchema,
    consent: z.literal(true, {
      errorMap: () => ({ message: 'You must consent to receive WhatsApp messages' }),
    }),
  })
  .strict();

export const requestOtpSchema = z
  .object({
    phone: phoneSchema,
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    phone: phoneSchema,
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  })
  .strict();

export const loginSchema = z
  .object({
    phone: phoneSchema,
    password: z.string().min(1),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const forgotSchema = z
  .object({
    phone: phoneSchema,
  })
  .strict();

export const resetSchema = z
  .object({
    phone: phoneSchema,
    code: z.string().regex(/^\d{6}$/),
    newPassword: passwordSchema,
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
