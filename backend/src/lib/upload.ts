/**
 * Multer middleware for POP uploads. Memory storage keeps the buffer in
 * RAM long enough to stream it to Cloudinary — we never write to local
 * disk. Mirrors `techproof/apps/api/src/lib/upload.js`.
 *
 * The 10 MB cap matches SECURITY.md. Multer rejects larger uploads with
 * a MulterError before the handler runs.
 */
import multer from 'multer';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: image/* or application/pdf.`));
};

export const popUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});
