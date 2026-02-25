import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { VideoAssetProvider } from '@prisma/client';
import { NextRequest } from 'next/server';
import { apiErrors, successResponse, withCacheControl } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { cleanupBunnyStreamVideos } from '@/lib/bunny-stream-cleanup';
import {
  canDeleteAssetForViewer,
  extractImageKeyFromProxyUrl,
  getVideoAssetAccessContext,
} from '@/lib/video-assets';

type RouteParams = { params: Promise<{ videoId: string; assetId: string }> };

// DELETE /api/videos/[videoId]/assets/[assetId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const limited = await rateLimit(request, 'asset-delete');
    if (limited) return limited;

    const { videoId, assetId } = await params;
    const context = await getVideoAssetAccessContext(request, videoId, 'COMMENT');
    if (!context) return apiErrors.notFound('Video');
    if (!context.canUploadAssets) return apiErrors.forbidden('Access denied');

    const asset = await db.videoAsset.findFirst({
      where: { id: assetId, videoId },
      select: {
        id: true,
        provider: true,
        sourceUrl: true,
        providerVideoId: true,
        uploadedByUserId: true,
        uploadedByGuestIdentityId: true,
      },
    });

    if (!asset) return apiErrors.notFound('Asset');
    if (!canDeleteAssetForViewer(asset, context)) {
      return apiErrors.forbidden('You can only delete assets you uploaded');
    }

    let shouldDeleteImageObject = false;
    await db.$transaction(async (tx) => {
      await tx.videoAsset.delete({ where: { id: asset.id } });

      if (asset.provider === VideoAssetProvider.R2_IMAGE) {
        const [assetReferenceCount, commentReferenceCount] = await Promise.all([
          tx.videoAsset.count({ where: { sourceUrl: asset.sourceUrl } }),
          tx.comment.count({ where: { imageUrl: asset.sourceUrl } }),
        ]);
        shouldDeleteImageObject = assetReferenceCount === 0 && commentReferenceCount === 0;
      }
    });

    if (asset.provider === VideoAssetProvider.R2_IMAGE && shouldDeleteImageObject) {
      const imageKey = extractImageKeyFromProxyUrl(asset.sourceUrl);
      if (imageKey) {
        try {
          await r2Client.send(new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: imageKey,
          }));
        } catch (error) {
          console.error(`Failed to delete R2 image asset ${imageKey}:`, error);
        }
      }
    }

    if (asset.provider === VideoAssetProvider.BUNNY && asset.providerVideoId) {
      try {
        await cleanupBunnyStreamVideos([{
          providerId: 'bunny',
          videoId: asset.providerVideoId,
        }]);
      } catch (error) {
        console.error(`Failed to cleanup Bunny asset ${asset.providerVideoId}:`, error);
      }
    }

    const response = successResponse({ message: 'Asset deleted' });
    return withCacheControl(response, 'private, no-store');
  } catch (error) {
    console.error('Error deleting video asset:', error);
    return apiErrors.internalError('Failed to delete asset');
  }
}
