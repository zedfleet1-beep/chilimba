/**
 * Typed errors. The service layer throws these; the central errorHandler
 * turns them into the standard API response shape.
 *
 *   { success: false, error: { code, message } }
 */

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_PHONE_FORMAT'
  | 'WEAK_PASSWORD'
  | 'CONSENT_REQUIRED'
  | 'PHONE_ALREADY_EXISTS'
  | 'ALREADY_ACTIVATED'
  | 'ACTIVATION_NOT_AVAILABLE'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'OTP_LOCKED'
  | 'OTP_NOT_VERIFIED'
  | 'RATE_LIMITED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_SUSPENDED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL';

export class AppError extends Error {
  public readonly httpCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;

  constructor(httpCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.httpCode = httpCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_FAILED', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super(401, 'INVALID_CREDENTIALS', 'Invalid phone or password');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ActivationNotAvailableError extends AppError {
  constructor(
    message = 'No account found for this number. Ask your group admin to add you, or create a new account.',
  ) {
    super(404, 'ACTIVATION_NOT_AVAILABLE', message);
  }
}

export class ConflictError extends AppError {
  constructor(code: ErrorCode, message: string) {
    super(409, code, message);
  }
}

export class OtpExpiredError extends AppError {
  constructor() {
    super(410, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.');
  }
}

export class OtpNotVerifiedError extends AppError {
  constructor() {
    super(401, 'OTP_NOT_VERIFIED', 'Phone number is not verified. Please complete OTP verification.');
  }
}

export class OtpLockedError extends AppError {
  constructor() {
    super(423, 'OTP_LOCKED', 'Too many incorrect attempts. Please try again in 15 minutes.');
  }
}

export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(429, 'RATE_LIMITED', message);
  }
}
