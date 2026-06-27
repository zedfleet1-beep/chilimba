/**
 * Rate limit for /auth/* routes: 10 req/min per IP (SECURITY.md).
 * In test env, the limit is effectively disabled so the integration tests
 * can exercise every endpoint in the same process without hitting it.
 */
import rateLimit from 'express-rate-limit';
import { env } from '@/env';

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: env.NODE_ENV === 'test' ? 100_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again in a minute.',
    },
  },
});
