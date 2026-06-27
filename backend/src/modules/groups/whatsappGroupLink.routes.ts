/**
 * WhatsApp group linking. /api/v1/groups/:id/whatsapp/*
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireGroupRole } from '@/middleware/requireGroupRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import {
  sendWhatsappGroupVerificationSchema,
  verifyWhatsappGroupLinkSchema,
} from './whatsappGroupLink.validators';
import {
  getWhatsappLinkInfo,
  listLinkableWhatsappGroups,
  sendWhatsappGroupVerification,
  verifyWhatsappGroupLink,
  unlinkWhatsappGroup,
} from './whatsappGroupLink.service';

const router = Router({ mergeParams: true });
router.use(requireAuth);
router.use(requireGroupRole('owner'));

router.get(
  '/link-info',
  ah(async (req, res) => {
    const info = await getWhatsappLinkInfo(req.params.id, req.user!.id);
    res.json({ success: true, data: info });
  }),
);

router.get(
  '/groups',
  ah(async (req, res) => {
    const data = await listLinkableWhatsappGroups(req.params.id, req.user!.id);
    res.json({ success: true, data });
  }),
);

router.post(
  '/send-verification',
  ah(async (req, res) => {
    const body = parseBody(sendWhatsappGroupVerificationSchema, req.body);
    const result = await sendWhatsappGroupVerification(req.params.id, req.user!.id, body);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/verify',
  ah(async (req, res) => {
    const body = parseBody(verifyWhatsappGroupLinkSchema, req.body);
    const result = await verifyWhatsappGroupLink(req.params.id, req.user!.id, body.code);
    res.json({ success: true, data: result });
  }),
);

router.delete(
  '/link',
  ah(async (req, res) => {
    const result = await unlinkWhatsappGroup(req.params.id, req.user!.id);
    res.json({ success: true, data: result });
  }),
);

export default router;