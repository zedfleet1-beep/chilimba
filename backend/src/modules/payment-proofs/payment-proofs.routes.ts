/**
 * Payment-proofs routes.
 *   Admin:   POST /api/v1/admin/pops/:id/approve
 *            POST /api/v1/admin/pops/:id/reject
 *   Customer: POST /api/v1/payment-proofs/:id/refresh-url
 *
 * Mounted twice in app.ts — once at /api/v1/admin/pops (admin actions) and
 * once at /api/v1/payment-proofs (customer download URL).
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireRole } from '@/middleware/requireRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import { approvePopSchema, rejectPopSchema } from './payment-proofs.validators';
import { approvePop, rejectPop, getPopDownloadUrl } from './payment-proofs.service';

const router = Router();

// All payment-proof routes require an authenticated user.
router.use(requireAuth);

router.post(
  '/:id/approve',
  requireRole('super_admin'),
  ah(async (req, res) => {
    parseBody(approvePopSchema, req.body ?? {});
    const result = await approvePop(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/:id/reject',
  requireRole('super_admin'),
  ah(async (req, res) => {
    const input = parseBody(rejectPopSchema, req.body);
    const pop = await rejectPop(req.params.id, req.user!.id, input.reason);
    res.json({ success: true, data: pop });
  }),
);

router.post(
  '/:id/refresh-url',
  ah(async (req, res) => {
    const result = await getPopDownloadUrl(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  }),
);

export default router;
