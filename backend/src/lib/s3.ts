/**
 * S3 client (MinIO-compatible). Used for POP uploads (Week 3+).
 * Wired now so the auth module doesn't need to change later.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/env';
import { v4 as uuid } from 'uuid';

let _client: S3Client | undefined;

export function getS3(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  });
  return _client;
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per SECURITY.md

export function validateUpload(contentType: string, size: number): void {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error(`Disallowed content type: ${contentType}`);
  }
  if (size > MAX_BYTES) {
    throw new Error(`File too large: ${size} > ${MAX_BYTES} bytes`);
  }
}

export function buildObjectKey(prefix: string, contentType: string): string {
  const ext = contentType === 'image/jpeg' ? 'jpg'
            : contentType === 'image/png' ? 'png'
            : 'pdf';
  return `${prefix}/${uuid()}.${ext}`;
}

export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getS3(), cmd, { expiresIn: 60 * 5 }); // 5 min
}

export async function getDownloadUrl(key: string, expiresInSeconds = 60 * 10): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(getS3(), cmd, { expiresIn: expiresInSeconds });
}
