/**
 * Payout routes. /api/v1/groups/:id/cycles/:cid/rounds/:rid/payouts/*
 *
 *   GET    /                       — any active member (list)
 *   POST   /record                 — owner/treasurer (multipart, optional file)
 *   POST   /reroll                 — owner only (random payout method)
 *
 * Group isolation is enforced by `requireGroupRole` on every route.
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireGroupRole } from '@/middleware/requireGroupRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import { popUpload } from '@/lib/upload';
import { recordPayout, rerollRandomPayouts, listPayouts, assignPayoutRecipients } from './payouts.service';
import { rerollPayoutsSchema, assignPayoutRecipientsSchema } from './payouts.validators';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get(
  '/',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const list = await listPayouts(
      req.params.id,
      req.params.cid,
      req.params.rid,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: list });
  }),
);

router.post(
  '/record',
  requireGroupRole('owner', 'treasurer'),
  popUpload.single('file'),
  ah(async (req, res) => {
    const result = await recordPayout({
      groupId: req.params.id,
      cycleId: req.params.cid,
      roundId: req.params.rid,
      requester: { id: req.user!.id, role: req.groupMembership!.role },
      file: req.file
        ? {
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname,
            size: req.file.size,
          }
        : undefined,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
    });
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/reroll',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    parseBody(rerollPayoutsSchema, req.body ?? {});
    const list = await rerollRandomPayouts(
      req.params.id,
      req.params.cid,
      req.params.rid,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: list });
  }),
);

router.post(
  '/assign',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    const body = parseBody(assignPayoutRecipientsSchema, req.body);
    const list = await assignPayoutRecipients(
      req.params.id,
      req.params.cid,
      req.params.rid,
      body.memberIds,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: list });
  }),
);

export default router;
