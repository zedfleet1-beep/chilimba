/**
 * Authenticate the `POST /api/v1/groups` request using the 48h signed
 * group-creation token. The token is delivered in a WhatsApp link, so the
 * caller is the customer (who may not have a Chilimba `User` row yet).
 *
 * On success: attaches `req.groupCreation = { invoiceId, phone }` and calls
 * `next()`. On failure: forwards an UnauthorizedError to the central handler.
 */
import { Request, Response, NextFunction } from 'express';
import { verifyGroupCreationToken } from '@/lib/jwt';
import { UnauthorizedError } from '@/lib/errors';

export function requireGroupCreationToken(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyGroupCreationToken(token);
    req.groupCreation = { invoiceId: payload.invoiceId, phone: payload.phone };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired group-creation token'));
  }
}
