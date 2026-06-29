/**
 * Payment-settings routes. /api/v1/payment-settings/*
 *
 *   GET    /api/v1/payment-settings/platform           — super_admin
 *   PUT    /api/v1/payment-settings/platform           — super_admin
 *   GET    /api/v1/payment-settings/effective?invoiceId — authed
 *   GET    /api/v1/payment-settings/by-invoice/:id     — super_admin
 *   PUT    /api/v1/payment-settings/by-invoice/:id     — super_admin
 *
 * No DB calls in this file — all logic in payment-settings.service.ts.
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireRole } from '@/middleware/requireRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import {
  platformDefaultSchema,
  invoiceOverrideSchema,
  effectiveQuerySchema,
  contributionQuerySchema,
} from './payment-settings.validators';
import {
  getPlatformDefault,
  upsertPlatformDefault,
  getByInvoice,
  upsertInvoiceOverride,
  getEffectiveForInvoice,
  getContributionPaymentDetails,
} from './payment-settings.service';

const router = Router();

// All payment-settings routes require an authenticated user.
router.use(requireAuth);

router.get(
  '/platform',
  requireRole('super_admin'),
  ah(async (_req, res) => {
    const setting = await getPlatformDefault();
    res.json({ success: true, data: setting });
  }),
);

router.put(
  '/platform',
  requireRole('super_admin'),
  ah(async (req, res) => {
    const input = parseBody(platformDefaultSchema, req.body);
    const setting = await upsertPlatformDefault(input, req.user!.id);
    res.json({ success: true, data: setting });
  }),
);

router.get(
  '/contribution-default',
  requireAuth,
  ah(async (req, res) => {
    const { groupId } = parseBody(contributionQuerySchema, req.query);
    const setting = await getContributionPaymentDetails(groupId);
    res.json({ success: true, data: setting });
  }),
);

router.get(
  '/effective',
  requireAuth,
  ah(async (req, res) => {
    const { invoiceId } = parseBody(effectiveQuerySchema, req.query);
    const setting = await getEffectiveForInvoice(invoiceId);
    res.json({ success: true, data: setting });
  }),
);

router.get(
  '/by-invoice/:invoiceId',
  requireRole('super_admin'),
  ah(async (req, res) => {
    const setting = await getByInvoice(req.params.invoiceId);
    res.json({ success: true, data: setting });
  }),
);

router.put(
  '/by-invoice/:invoiceId',
  requireRole('super_admin'),
  ah(async (req, res) => {
    const input = parseBody(invoiceOverrideSchema, req.body);
    const setting = await upsertInvoiceOverride(req.params.invoiceId, input, req.user!.id);
    res.json({ success: true, data: setting });
  }),
);

export default router;
