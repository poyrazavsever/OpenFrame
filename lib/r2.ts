import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_ENDPOINT = process.env.R2_ENDPOINT;

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadAudio(
  buffer: Buffer,
  filename: string,
  contentType: string = 'audio/webm'
): Promise<string> {
  // Sanitize: strip any path components, use only the basename
  const sanitized = filename.replace(/^.*[\\/]/, '').replace(/\.\.+/g, '');
  if (!sanitized) throw new Error('Invalid filename');
  const key = `voice/${sanitized}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  // R2 public URL — uses the R2.dev subdomain or custom domain
  // For development, we use the R2.dev auto-generated URL
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

export { R2_BUCKET_NAME };
