import { NextResponse } from 'next/server';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { apiErrors } from '@/lib/api-response';
import { db } from '@/lib/db';

// Only allow UUID filenames with safe extensions
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

const CONTENT_TYPE_MAP: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
};
const UNATTACHED_UPLOAD_TTL_MS = 15 * 60 * 1000;

function getContentType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return CONTENT_TYPE_MAP[ext] || 'image/jpeg';
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

        const key = `images/${filename}`;
        const mediaUrl = `/api/upload/image/${filename}`;

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
                where: { imageUrl: mediaUrl },
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

        const contentType = headResponse.ContentType || getContentType(filename);

        const objectResponse = await r2Client.send(
            new GetObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: key,
            })
        );

        const body = objectResponse.Body;
        if (!body) {
            return apiErrors.internalError('Empty file');
        }

        const chunks: Uint8Array[] = [];
        // @ts-expect-error - body is an iterable
        for await (const chunk of body) {
            chunks.push(chunk);
        }
        const uint8Array = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
            uint8Array.set(chunk, offset);
            offset += chunk.length;
        }

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
        console.error('Error serving image:', error);
        return apiErrors.internalError('Failed to retrieve image');
    }
}
