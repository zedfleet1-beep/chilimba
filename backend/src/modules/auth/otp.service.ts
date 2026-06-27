/**
 * OTP generation, storage, verification, and brute-force protection.
 * Rules from SECURITY.md:
 *   - 6 digits, 10-minute expiry, single-use
 *   - max 5 attempts, then 15-minute lockout
 *   - max 3 resends per 30 minutes per phone
 */
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { OtpPurpose, Otp } from '@prisma/client';
import { OtpExpiredError, OtpLockedError, UnauthorizedError } from '@/lib/errors';

const OTP_TTL_MS = 10 * 60 * 1000;          // 10 min
const LOCKOUT_MS = 15 * 60 * 1000;          // 15 min
const MAX_ATTEMPTS = 5;
const RESEND_WINDOW_MS = 30 * 60 * 1000;    // 30 min
const MAX_RESENDS = 3;

function generateCode(): string {
  // Uniform 6-digit code, no modulo bias
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export interface CreateOtpResult {
  code: string;
  otp: Otp;
}

/** Create a new OTP, invalidating any prior un-used codes for the same purpose. */
export async function createOtp(userId: string, purpose: OtpPurpose): Promise<CreateOtpResult> {
  // Invalidate prior un-used OTPs
  await prisma.otp.updateMany({
    where: { userId, purpose, used: false },
    data: { used: true },
  });

  const code = generateCode();
  const otp = await prisma.otp.create({
    data: {
      userId,
      purpose,
      code,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  return { code, otp };
}

/** Check resend rate limit. Throws if exceeded. */
export async function assertResendAllowed(userId: string): Promise<void> {
  const since = new Date(Date.now() - RESEND_WINDOW_MS);
  const recent = await prisma.otp.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (recent >= MAX_RESENDS) {
    throw new Error('Too many OTP requests. Please try again later.');
  }
}

export interface VerifyOtpResult {
  userId: string;
}

/**
 * Verify an OTP. Throws OtpExpiredError if expired, OtpLockedError if locked out.
 * Increments `attempts` on each wrong call; locks the OTP at MAX_ATTEMPTS.
 * Marks the OTP used and returns the userId on success.
 */
export async function verifyOtp(userId: string, code: string, purpose: OtpPurpose): Promise<VerifyOtpResult> {
  const otp = await prisma.otp.findFirst({
    where: { userId, purpose, used: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw new OtpExpiredError();
  }

  // Lockout check
  if (otp.lockedUntil && otp.lockedUntil > new Date()) {
    throw new OtpLockedError();
  }

  // Expiry check
  if (otp.expiresAt < new Date()) {
    throw new OtpExpiredError();
  }

  // Code check
  if (otp.code !== code) {
    const attempts = otp.attempts + 1;
    const shouldLock = attempts >= MAX_ATTEMPTS;
    await prisma.otp.update({
      where: { id: otp.id },
      data: {
        attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MS) : null,
        used: shouldLock, // exhausted
      },
    });
    if (shouldLock) {
      throw new OtpLockedError();
    }
    throw new UnauthorizedError('Incorrect OTP code');
  }

  // Success: mark used
  await prisma.otp.update({
    where: { id: otp.id },
    data: { used: true },
  });

  return { userId };
}
