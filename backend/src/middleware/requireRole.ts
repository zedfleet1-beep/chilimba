/**
 * Role-based authorization. Apply after requireAuth.
 *
 *   router.get('/admin/foo', requireAuth, requireRole('super_admin'), handler)
 */
import { Request, Response, NextFunction } from 'express';
import { Role } from '@/lib/jwt';
import { ForbiddenError } from '@/lib/errors';

export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }
    if (!allowed.includes(req.user.role)) {
      throw new ForbiddenError(`Required role: ${allowed.join(' or ')}`);
    }
    next();
  };
}
