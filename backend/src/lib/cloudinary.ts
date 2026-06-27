/**
 * Cloudinary client. Mirrors the pattern in
 * `car-fleet-management-backend/src/controllers/expenseController.js` and
 * `techproof/apps/api/src/lib/cloudinary.js`.
 *
 * Why we keep only the URL in the DB (per the project owner):
 *   - Cloudinary is the source of truth for the file bytes.
 *   - The DB row stores just the `secure_url` and the `public_id` so we
 *     can destroy the asset later (on POP rejection, or on re-upload).
 *   - Storing the actual file in the DB would double the storage cost
 *     and break Cloudinary's CDN delivery.
 */
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';

export type CloudinaryResourceType = 'image' | 'raw' | 'video' | 'auto';

let configured = false;

function configure(): void {
  if (configured) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary is not configured (set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)',
    );
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  configured = true;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

/**
 * Map an incoming MIME type to the Cloudinary `resource_type` we use to
 * destroy the asset later. For uploads we use `resource_type: 'auto'`
 * (Cloudinary detects), but destroy needs the explicit type.
 */
export function resourceTypeForMime(mimetype: string | undefined | null): CloudinaryResourceType {
  if (!mimetype) return 'image';
  return mimetype === 'application/pdf' ? 'raw' : 'image';
}

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
}

/**
 * Stream a buffer to Cloudinary via the `upload_stream` API. Mirrors the
 * reference's `uploadBufferToCloudinary`. Returns the secure URL and the
 * public_id so the DB row can later call `destroyAsset` for cleanup.
 *
 *   payment_proofs.fileKey     ← Cloudinary public_id (so we can destroy)
 *   payment_proofs.fileUrl     ← Cloudinary secure_url (what we show the admin)
 *   payment_proofs.resourceType ← 'image' | 'raw' (for private PDF URLs)
 */
export function uploadBufferToCloudinary(
  buffer: Buffer,
  options: { folder?: string; publicId?: string } = {},
): Promise<CloudinaryUploadResult> {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ?? 'chilimba/payment_proofs',
        resource_type: 'auto',
        timeout: Number(process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS) || 120_000,
        ...(options.publicId ? { public_id: options.publicId } : {}),
      },
      (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload returned no result'));
          return;
        }
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: (result.resource_type as CloudinaryResourceType) ?? 'image',
        });
      },
    );
    stream.end(buffer);
  });
}

/**
 * Best-effort destroy. Never throws — if the asset is already gone or the
 * network is down, we just log it. Callers can decide whether to surface.
 */
export async function destroyAsset(
  publicId: string | null | undefined,
  resourceType: CloudinaryResourceType = 'image',
): Promise<void> {
  if (!publicId) return;
  try {
    configure();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: 'upload',
      invalidate: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Cloudinary destroy failed:', (err as Error)?.message ?? err);
  }
}
