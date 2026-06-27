/**
 * Per-group authorization. Loads the caller's `GroupMember` row by
 * (groupId, userId), verifies the membership is `active`, and checks the
 * role is in the allowed list. On success, attaches `req.groupMembership`
 * for the service layer.
 *
 *   router.get('/groups/:id', requireAuth, requireGroupRole('owner', 'treasurer', 'member'), handler)
 *
 * Hard rule (see SECURITY.md Authorization §4): every group-scoped query
 * is keyed off the verified groupId from this middleware, never from a
 * request body or query param.
 */
import { Request, Response, NextFunction } from 'express';
import { GroupMemberRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, NotFoundError } from '@/lib/errors';

export function requireGroupRole(...allowed: GroupMemberRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required');
      }
      const groupId = req.params.id;
      if (!groupId) {
        throw new NotFoundError('Group');
      }
      const membership = await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: req.user.id } },
      });
      if (!membership) {
        throw new ForbiddenError('You are not a member of this group');
      }
      if (membership.status !== 'active') {
        throw new ForbiddenError('Your membership is not active');
      }
      if (!allowed.includes(membership.role)) {
        throw new ForbiddenError(
          `Required role: ${allowed.join(' or ')} (you are ${membership.role})`,
        );
      }
      req.groupMembership = {
        groupId: membership.groupId,
        memberId: membership.id,
        userId: membership.userId,
        role: membership.role,
        payoutPosition: membership.payoutPosition,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
