/**
 * Super-admin routes. /api/v1/admin/*
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireRole } from '@/middleware/requireRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import {
  listWhatsappLogsQuerySchema,
  sendWhatsappSchema,
} from './admin.validators';
import {
  getAdminStats,
  listAdminGroups,
  suspendGroup,
  reactivateGroup,
  listAdminUsers,
  suspendUser,
  listWhatsappLogs,
  sendManualWhatsapp,
} from './admin.service';

const router = Router();
router.use(requireAuth, requireRole('super_admin'));

router.get(
  '/stats',
  ah(async (_req, res) => {
    const stats = await getAdminStats();
    res.json({ success: true, data: stats });
  }),
);

router.get(
  '/groups',
  ah(async (_req, res) => {
    const groups = await listAdminGroups();
    res.json({ success: true, data: groups });
  }),
);

router.post(
  '/groups/:id/suspend',
  ah(async (req, res) => {
    const group = await suspendGroup(req.params.id);
    res.json({ success: true, data: group });
  }),
);

router.post(
  '/groups/:id/reactivate',
  ah(async (req, res) => {
    const group = await reactivateGroup(req.params.id);
    res.json({ success: true, data: group });
  }),
);

router.get(
  '/users',
  ah(async (_req, res) => {
    const users = await listAdminUsers();
    res.json({ success: true, data: users });
  }),
);

router.post(
  '/users/:id/suspend',
  ah(async (req, res) => {
    const user = await suspendUser(req.params.id);
    res.json({ success: true, data: user });
  }),
);

router.get(
  '/whatsapp-logs',
  ah(async (req, res) => {
    const query = parseBody(listWhatsappLogsQuerySchema, req.query);
    const logs = await listWhatsappLogs(query);
    res.json({ success: true, data: logs });
  }),
);

router.post(
  '/whatsapp/send',
  ah(async (req, res) => {
    const input = parseBody(sendWhatsappSchema, req.body);
    const result = await sendManualWhatsapp(input);
    res.json({ success: true, data: result });
  }),
);

export default router;