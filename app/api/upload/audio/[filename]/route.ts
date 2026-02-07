import { NextResponse } from 'next/server';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { apiErrors } from '@/lib/api-response';

// Only allow UUID filenames with safe extensions
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

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

    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      })
    );

    if (!response.Body) {
      return apiErrors.notFound('File');
    }

    const contentType = response.ContentType || 'audio/webm';
    const contentLength = response.ContentLength;

    // Stream the response body directly instead of buffering in memory
    const stream = response.Body.transformToWebStream();

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': String(contentLength) } : {}),
        'Cache-Control': 'public, max-age=31536000, immutable',
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
