/**
 * Admin endpoints for cycle operations. /api/v1/admin/cycles/*
 *
 *   POST /api/v1/admin/cycles/check-late  — super_admin only.
 *     Manually triggers the late-detection job. Useful for tests and
 *     for the admin to "run the cron now" without waiting until 00:00 UTC.
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireRole } from '@/middleware/requireRole';
import { ah } from '@/lib/routeHelpers';
import { runLateDetection } from './lateDetection';
import { runContributionReminders } from './contributionReminders';

const router = Router();
router.use(requireAuth);

router.post(
  '/check-late',
  requireRole('super_admin'),
  ah(async (_req, res) => {
    const result = await runLateDetection();
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/send-reminders',
  requireRole('super_admin'),
  ah(async (_req, res) => {
    const result = await runContributionReminders();
    res.json({ success: true, data: result });
  }),
);

export default router;
