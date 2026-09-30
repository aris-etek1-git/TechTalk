import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';

const s3 = new S3Client({
  endpoint: config.storage.endpoint,
  region: config.storage.region,
  credentials: {
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  },
  // Minikio serves buckets under the path, not under a virtual host.
  forcePathStyle: true,
});

/** Accepted uploads, mapped to the file extension written into the object key. */
export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/** Quotes and control characters would break out of the Content-Disposition header. */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '')
    .trim()
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : 'document';
}

/**
 * Reads the file signature instead of trusting the declared content type: a
 * browser happily labels an .exe as application/pdf.
 */
export function sniffMimeType(bytes: Buffer): string | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  return null;
}

/**
 * Keys are built from a course uuid and a hex digest, never from the client's
 * filename, so an upload can not address another object in the bucket.
 */
export function buildStorageKey(courseId: string, checksum: string, mimeType: string): string {
  const extension = ALLOWED_UPLOAD_TYPES[mimeType] ?? 'bin';
  return `documents/${courseId}/${checksum}.${extension}`;
}

export async function putObject(key: string, body: Buffer, mimeType: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: config.storage.bucket,
    Key: key,
    Body: body,
    ContentType: mimeType,
    ContentLength: body.byteLength,
    // Public bucket reads are off; nothing may be sniffed as active content.
    ContentDisposition: 'attachment',
  }));
}

export async function presignDownload(key: string, fileName: string): Promise<string> {
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: config.storage.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeFileName(fileName)}"`,
    }),
    { expiresIn: config.storage.signedUrlTtlSeconds },
  );
  return url;
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key }));
}
