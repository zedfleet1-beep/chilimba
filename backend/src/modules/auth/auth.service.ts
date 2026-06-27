/**
 * Auth service. Pure business logic — no req/res, no Prisma calls in routes.
 *
 * Exports: signup, requestOtp, verifyOtp, login, refresh, logout,
 *          forgotPassword, resetPassword, me.
 */
import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';
import { normalizePhone } from '@/lib/phone';
import { signAccessToken, signRefreshToken, verifyRefreshToken, Role } from '@/lib/jwt';
import { sendWhatsApp, otpTemplate, welcomeTemplate, passwordResetTemplate } from '@/lib/whatsapp';
import { assertResendAllowed, createOtp, verifyOtp } from './otp.service';
import {
  ConflictError,
  InvalidCredentialsError,
  NotFoundError,
  OtpExpiredError,
  OtpLockedError,
  OtpNotVerifiedError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors';
import { OtpPurpose, User, UserStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { SignupInput, LoginInput, VerifyOtpInput, ResetInput, ForgotInput } from './auth.validators';

// In-memory refresh-token blacklist (Phase 2 will move to Redis).
const revokedRefreshTokens = new Set<string>();

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  role: Role;
  otpVerified: boolean;
};

function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    email: u.email,
    role: u.role as Role,
    otpVerified: u.otpVerified,
  };
}

function issueTokens(user: Pick<User, 'id' | 'role'>): { accessToken: string; refreshToken: string; jti: string } {
  const accessToken = signAccessToken({ sub: user.id, role: user.role as Role });
  const jti = uuid();
  const refreshToken = signRefreshToken({ sub: user.id, jti });
  return { accessToken, refreshToken, jti };
}

// =============================================================================
// SIGNUP
// =============================================================================

export async function signup(input: SignupInput): Promise<{ userId: string; phone: string }> {
  const phone = normalizePhone(input.phone);
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    throw new ConflictError('PHONE_ALREADY_EXISTS', 'An account with this phone number already exists.');
  }
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone,
      email: input.email ?? null,
      passwordHash,
      otpVerified: false,
    },
  });

  const { code } = await createOtp(user.id, OtpPurpose.signup);
  await sendWhatsApp(phone, otpTemplate(code));

  return { userId: user.id, phone: user.phone };
}

// =============================================================================
// REQUEST OTP (resend)
// =============================================================================

export async function requestOtp(phoneInput: string): Promise<{ ok: true }> {
  const phone = normalizePhone(phoneInput);
  const user = await prisma.user.findUnique({ where: { phone } });
  // Always return success to avoid phone enumeration
  if (!user) return { ok: true };
  if (user.otpVerified) return { ok: true };

  await assertResendAllowed(user.id);
  const { code } = await createOtp(user.id, OtpPurpose.signup);
  await sendWhatsApp(phone, otpTemplate(code));
  return { ok: true };
}

// =============================================================================
// VERIFY OTP
// =============================================================================

export async function verifyOtpAndIssueTokens(input: VerifyOtpInput): Promise<AuthResult> {
  const phone = normalizePhone(input.phone);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw new OtpExpiredError();
  }
  await verifyOtp(user.id, input.code, OtpPurpose.signup);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { otpVerified: true },
  });

  // Send welcome WhatsApp (best-effort, don't block)
  sendWhatsApp(updated.phone, welcomeTemplate(updated.firstName, updated.phone)).catch((e) =>
    logger.warn({ err: e.message }, 'welcome message enqueue failed'),
  );

  const { accessToken, refreshToken } = issueTokens(updated);
  return { user: toPublicUser(updated), accessToken, refreshToken };
}

// =============================================================================
// LOGIN
// =============================================================================

export async function login(input: LoginInput): Promise<AuthResult> {
  const phone = normalizePhone(input.phone);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.status === UserStatus.suspended) {
    throw new InvalidCredentialsError();
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new InvalidCredentialsError();
  }
  if (!user.otpVerified) {
    throw new OtpNotVerifiedError();
  }
  const { accessToken, refreshToken } = issueTokens(user);
  return { user: toPublicUser(user), accessToken, refreshToken };
}

// =============================================================================
// REFRESH
// =============================================================================

export async function refresh(refreshToken: string): Promise<{ accessToken: string }> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  if (revokedRefreshTokens.has(refreshToken)) {
    throw new UnauthorizedError('Refresh token has been revoked');
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === UserStatus.suspended) {
    throw new UnauthorizedError('User no longer active');
  }
  const accessToken = signAccessToken({ sub: user.id, role: user.role as Role });
  return { accessToken };
}

// =============================================================================
// LOGOUT
// =============================================================================

export async function logout(refreshToken: string): Promise<{ ok: true }> {
  revokedRefreshTokens.add(refreshToken);
  // Cap the in-memory blacklist to avoid unbounded growth
  if (revokedRefreshTokens.size > 10_000) {
    const first = revokedRefreshTokens.values().next().value;
    if (first) revokedRefreshTokens.delete(first);
  }
  return { ok: true };
}

// =============================================================================
// FORGOT PASSWORD
// =============================================================================

export async function forgotPassword(input: ForgotInput): Promise<{ ok: true }> {
  const phone = normalizePhone(input.phone);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return { ok: true }; // do not leak existence
  await assertResendAllowed(user.id);
  const { code } = await createOtp(user.id, OtpPurpose.password_reset);
  await sendWhatsApp(phone, passwordResetTemplate(code));
  return { ok: true };
}

// =============================================================================
// RESET PASSWORD
// =============================================================================

export async function resetPassword(input: ResetInput): Promise<{ ok: true }> {
  const phone = normalizePhone(input.phone);
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    throw new NotFoundError('Account');
  }
  await verifyOtp(user.id, input.code, OtpPurpose.password_reset);
  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
  // In a real system we'd also invalidate all refresh tokens; in Phase 2 with
  // per-user jti storage, we'd clear them. For now we just log it.
  logger.info({ userId: user.id }, 'password reset');
  return { ok: true };
}

// =============================================================================
// ME
// =============================================================================

export async function me(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  return toPublicUser(user);
}

// Re-export for convenience
export { OtpExpiredError, OtpLockedError, ValidationError };
