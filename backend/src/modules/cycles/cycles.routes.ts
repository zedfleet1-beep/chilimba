/**
 * Cycle routes. /api/v1/groups/:id/cycles/*
 *
 *   GET    /api/v1/groups/:id/cycles          — any active member
 *   POST   /api/v1/groups/:id/cycles          — owner (open a new cycle)
 *   GET    /api/v1/groups/:id/cycles/:cid     — any active member
 *   POST   /api/v1/groups/:id/cycles/:cid/start — owner
 *   POST   /api/v1/groups/:id/cycles/:cid/complete — owner
 *
 * Group isolation is enforced by `requireGroupRole` on every route.
 * No Prisma calls in this file.
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireGroupRole } from '@/middleware/requireGroupRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import { openCycleSchema } from './cycles.validators';
import {
  openCycle,
  startCycle,
  listCycles,
  getCycle,
  completeCycle,
} from './cycles.service';

const router = Router({ mergeParams: true });

// All cycle routes require an authenticated user.
router.use(requireAuth);

// ---------- Read (any active member) ----------

router.get(
  '/',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const cycles = await listCycles(req.params.id, {
      id: req.user!.id,
      role: req.groupMembership!.role,
    });
    res.json({ success: true, data: cycles });
  }),
);

router.get(
  '/:cid',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const cycle = await getCycle(
      req.params.id,
      req.params.cid,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: cycle });
  }),
);

// ---------- Write (owner only) ----------

router.post(
  '/',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    parseBody(openCycleSchema, req.body ?? {});
    const cycle = await openCycle(req.params.id, {
      id: req.user!.id,
      role: req.groupMembership!.role,
    });
    res.status(201).json({ success: true, data: cycle });
  }),
);

router.post(
  '/:cid/start',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    const cycle = await startCycle(
      req.params.id,
      req.params.cid,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: cycle });
  }),
);

router.post(
  '/:cid/complete',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    const cycle = await completeCycle(
      req.params.id,
      req.params.cid,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: cycle });
  }),
);

export default router;
