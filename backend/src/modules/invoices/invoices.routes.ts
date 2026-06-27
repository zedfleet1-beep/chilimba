/**
 * Invoice routes. /api/v1/invoices/*
 *
 * Layering:
 *   - All Prisma calls live in invoices.service.ts.
 *   - All input validation in invoices.validators.ts.
 *   - This file is purely HTTP plumbing (middleware + handler).
 *
 * POP upload (Week 4): the customer POSTs the file as multipart/form-data;
 * multer puts the buffer in `req.file`; we stream it to Cloudinary.
 */
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '@/middleware/requireAuth';
import { requireRole } from '@/middleware/requireRole';
import { ah, parseBody } from '@/lib/routeHelpers';
import { popUpload } from '@/lib/upload';
import { isCloudinaryConfigured } from '@/lib/cloudinary';
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
} from './invoices.validators';
import {
  createInvoice,
  listInvoices,
  getInvoice,
  getMyInvoices,
  uploadPop,
} from './invoices.service';

const router = Router();

// All invoice routes require an authenticated user.
router.use(requireAuth);

// ---------- Admin-only ----------

router.post(
  '/',
  requireRole('super_admin'),
  ah(async (req, res) => {
    const input = parseBody(createInvoiceSchema, req.body);
    const invoice = await createInvoice(input, req.user!.id);
    res.status(201).json({ success: true, data: invoice });
  }),
);

router.get(
  '/',
  requireRole('super_admin'),
  ah(async (req, res) => {
    const query = parseBody(listInvoicesQuerySchema, req.query);
    const invoices = await listInvoices(query);
    res.json({ success: true, data: invoices });
  }),
);

router.get(
  '/mine',
  ah(async (req, res) => {
    const invoices = await getMyInvoices(req.user!.id);
    res.json({ success: true, data: invoices });
  }),
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const invoice = await getInvoice(req.params.id, req.user!.id);
    res.json({ success: true, data: invoice });
  }),
);

/**
 * POST /invoices/:id/pop
 *
 * Multipart upload. The frontend sends the file under the field name `file`.
 * Returns the created payment_proofs row (with fileUrl = Cloudinary secure_url).
 */
router.post(
  '/:id/pop',
  // Fail fast with a clear error if Cloudinary isn't configured, rather
  // than letting multer consume the upload and then 500ing.
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
    const result = await uploadPop(
      req.params.id,
      {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
      },
      req.user!.id,
    );
    res.status(201).json({ success: true, data: result.paymentProof });
  }),
);

// Make sure we keep multer's runtime reference (otherwise TS trims the import).
const _multer: typeof multer | undefined = undefined;
void _multer;

export default router;
