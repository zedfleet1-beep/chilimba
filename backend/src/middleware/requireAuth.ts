/**
 * Verifies the access JWT and attaches req.user.
 * Use as a route-level middleware on protected routes.
 */
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/lib/jwt';
import { UnauthorizedError } from '@/lib/errors';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
