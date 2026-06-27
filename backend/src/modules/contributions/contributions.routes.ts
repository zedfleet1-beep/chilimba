/**
 * Contribution routes. /api/v1/groups/:id/cycles/:cid/rounds/:rid/contributions/*
 *
 *   GET    /                              — any active member (list)
 *   POST   /upload/:memberId             — member (self) or owner/treasurer (multipart)
 *   POST   /:memberId/approve             — owner/treasurer
 *   POST   /:memberId/reject              — owner/treasurer
 *   POST   /:memberId/waive               — owner only
 *
 * Group isolation is enforced by `requireGroupRole` on every route.
 * No Prisma calls in this file.
 */
import { Router } from 'express';
import { requireAuth } from '@/middleware/requireAuth';
import { requireGroupRole } from '@/middleware/requireGroupRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import { popUpload } from '@/lib/upload';
import { isCloudinaryConfigured } from '@/lib/cloudinary';
import { rejectContributionSchema, recordContributionSchema } from './contributions.validators';
import {
  uploadContributionProof,
  approveContribution,
  rejectContribution,
  waiveContribution,
  listContributions,
  recordContribution,
} from './contributions.service';

const router = Router({ mergeParams: true });
router.use(requireAuth);

router.get(
  '/',
  requireGroupRole('owner', 'treasurer', 'member'),
  ah(async (req, res) => {
    const list = await listContributions(
      req.params.id,
      req.params.cid,
      req.params.rid,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: list });
  }),
);

router.post(
  '/upload/:memberId',
  requireGroupRole('owner', 'treasurer', 'member'),
  (_req, res, next) => {
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'CLOUDINARY_NOT_CONFIGURED',
          message: 'File storage is not configured on the server. Contact the admin.',
        },
      });
    }
    next();
  },
  popUpload.single('file'),
  ah(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'A file is required (image or PDF).' },
      });
    }
    const contribution = await uploadContributionProof(
      req.params.id,
      req.params.cid,
      req.params.rid,
      req.params.memberId,
      {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
      },
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.status(201).json({ success: true, data: contribution });
  }),
);

router.post(
  '/:memberId/record',
  requireGroupRole('owner', 'treasurer'),
  ah(async (req, res) => {
    const input = parseBody(recordContributionSchema, req.body ?? {});
    const contribution = await recordContribution(
      req.params.id,
      req.params.cid,
      req.params.rid,
      req.params.memberId,
      { id: req.user!.id, role: req.groupMembership!.role },
      input.notes,
    );
    res.json({ success: true, data: contribution });
  }),
);

router.post(
  '/:memberId/approve',
  requireGroupRole('owner', 'treasurer'),
  ah(async (req, res) => {
    const contribution = await approveContribution(
      req.params.id,
      req.params.cid,
      req.params.rid,
      req.params.memberId,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: contribution });
  }),
);

router.post(
  '/:memberId/reject',
  requireGroupRole('owner', 'treasurer'),
  ah(async (req, res) => {
    const input = parseBody(rejectContributionSchema, req.body);
    const contribution = await rejectContribution(
      req.params.id,
      req.params.cid,
      req.params.rid,
      req.params.memberId,
      { id: req.user!.id, role: req.groupMembership!.role },
      input.reason,
    );
    res.json({ success: true, data: contribution });
  }),
);

router.post(
  '/:memberId/waive',
  requireGroupRole('owner'),
  ah(async (req, res) => {
    const contribution = await waiveContribution(
      req.params.id,
      req.params.cid,
      req.params.rid,
      req.params.memberId,
      { id: req.user!.id, role: req.groupMembership!.role },
    );
    res.json({ success: true, data: contribution });
  }),
);

export default router;
