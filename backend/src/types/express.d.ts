/**
 * Augment Express Request with the auth payload attached by requireAuth.
 */
import { Role } from '@/lib/jwt';
import { GroupMemberRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
      };
      /** Set by requireGroupRole when the caller's membership is verified. */
      groupMembership?: {
        groupId: string;
        memberId: string;
        userId: string;
        role: GroupMemberRole;
        payoutPosition: number | null;
      };
      /** Set by requireGroupCreationToken. */
      groupCreation?: {
        invoiceId: string;
        phone: string;
      };
      requestId?: string;
    }
  }
}

export {};
