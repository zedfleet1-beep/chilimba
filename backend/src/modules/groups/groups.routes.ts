/**
 * Group + member routes. /api/v1/groups/*
 *
 * The `POST /` route uses the group-creation token (NOT requireAuth).
 * All other routes require a normal access JWT + a group membership.
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireGroupRole } from '@/middleware/requireGroupRole';
import { requireGroupCreationToken } from '@/middleware/requireGroupCreationToken';
import { ah, parseBody } from '@/lib/routeHelpers';
import {
  createGroupSchema,
  updateGroupSettingsSchema,
  addMemberSchema,
  updateMemberSchema,
} from './groups.validators';
import {
  createGroupFromToken,
  listMyGroups,
  getGroup,
  updateGroupSettings,
  getInvoiceForToken,
} from './groups.service';
import {
  addMember,
  listMembers,
  updateMember,
  removeMember,
} from './members.service';

const router = Router();

// ---------- Group-creation (token-based, NOT requireAuth) ----------

router.post(
  '/',
  requireGroupCreationToken,
  ah(async (req, res) => {
    const input = parseBody(createGroupSchema, req.body);
    const payload = req.groupCreation!;
    const result = await createGroupFromToken(payload, input);
    res.status(201).json({ success: true, data: result });
  }),
);

router.get(
  '/lookup-by-token',
  requireGroupCreationToken,
  ah(async (req, res) => {
    const payload = req.groupCreation!;
    const invoice = await getInvoiceForToken(payload);
    res.json({ success: true, data: { invoiceNumber: invoice.invoiceNumber, amountNgwe: invoice.amountNgwe } });
  }),
);

// ---------- Authenticated routes ----------

router.use(requireAuth);

router.get(
  '/',
  ah(async (req, res) => {
    const groups = await listMyGroups(req.user!.id);
    res.json({ success: true, data: groups });
  }),
);

router.get(
  '/:id',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const group = await getGroup(req.params.id);
    res.json({ success: true, data: group });
  }),
);

router.put(
  '/:id/settings',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    const patch = parseBody(updateGroupSettingsSchema, req.body);
    const settings = await updateGroupSettings(req.params.id, patch);
    res.json({ success: true, data: settings });
  }),
);

// ---------- Members ----------

router.get(
  '/:id/members',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const members = await listMembers(req.params.id);
    res.json({ success: true, data: members });
  }),
);

router.post(
  '/:id/members',
  requireGroupRole('owner', 'treasurer'),
  ah(async (req, res) => {
    const input = parseBody(addMemberSchema, req.body);
    const member = await addMember(req.params.id, { id: req.user!.id, role: req.groupMembership!.role }, input);
    res.status(201).json({ success: true, data: member });
  }),
);

router.put(
  '/:id/members/:memberId',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    const patch = parseBody(updateMemberSchema, req.body);
    const member = await updateMember(
      req.params.id,
      req.params.memberId,
      { id: req.user!.id, role: req.groupMembership!.role },
      patch,
    );
    res.json({ success: true, data: member });
  }),
);

router.delete(
  '/:id/members/:memberId',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    const member = await removeMember(
      req.params.id,
      req.params.memberId,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: member });
  }),
);

export default router;
