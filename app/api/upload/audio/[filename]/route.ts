import { NextResponse } from 'next/server';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { apiErrors } from '@/lib/api-response';
import { db } from '@/lib/db';

// Only allow UUID filenames with safe extensions
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

// Map extensions to content types
const CONTENT_TYPE_MAP: Record<string, string> = {
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};
const UNATTACHED_UPLOAD_TTL_MS = 15 * 60 * 1000;

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return CONTENT_TYPE_MAP[ext] || 'audio/webm';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Validate filename to prevent path traversal
    if (!SAFE_FILENAME.test(filename)) {
      return apiErrors.badRequest('Invalid filename');
    }

    const key = `voice/${filename}`;
    const mediaUrl = `/api/upload/audio/${filename}`;

    // Get file metadata to determine content type
    const headResponse = await r2Client.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    const lastModified = headResponse.LastModified;
    if (lastModified && Date.now() - lastModified.getTime() > UNATTACHED_UPLOAD_TTL_MS) {
      const referenced = await db.comment.findFirst({
        where: { voiceUrl: mediaUrl },
        select: { id: true },
      });
      if (!referenced) {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
          })
        ).catch(() => undefined);
        return apiErrors.notFound('File');
      }
    }

    // Use the stored content-type or infer from filename extension
    const contentType = headResponse.ContentType || getContentType(filename);

    // Get the object
    const objectResponse = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    // Handle the body properly - AWS SDK returns a stream
    const body = objectResponse.Body;
    if (!body) {
      return apiErrors.internalError('Empty file');
    }

    // Convert stream to Uint8Array
    const chunks: Uint8Array[] = [];
    const asyncIterable = body as AsyncIterable<Uint8Array>;
    for await (const chunk of asyncIterable) {
      chunks.push(chunk);
    }
    const uint8Array = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      uint8Array.set(chunk, offset);
      offset += chunk.length;
    }

    // Create response with proper content-type
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : '';
    if (errorName === 'NoSuchKey') {
      return apiErrors.notFound('File');
    }
    console.error('Error serving audio:', error);
    return apiErrors.internalError('Failed to retrieve audio');
  }
}
