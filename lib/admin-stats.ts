import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

// Cache for 10 minutes (600 seconds)
export const getCachedTotalStorage = unstable_cache(
    async () => {
        let totalStorageBytes = 0;
        try {
            let isTruncated = true;
            let continuationToken: string | undefined = undefined;

            while (isTruncated) {
                const commandParams: any = { Bucket: R2_BUCKET_NAME };
                if (continuationToken) commandParams.ContinuationToken = continuationToken;

                const data = await r2Client.send(new ListObjectsV2Command(commandParams));
                if (data.Contents) {
                    for (const item of data.Contents) {
                        totalStorageBytes += item.Size || 0;
                    }
                }
                isTruncated = data.IsTruncated ?? false;
                continuationToken = data.NextContinuationToken;
            }
        } catch (err) {
            console.error('Failed to fetch total storage stats:', err);
            return -1;
        }
        return totalStorageBytes;
    },
    ['admin-total-storage'],
    { revalidate: 600 }
);

export const getCachedUserVoiceStorage = unstable_cache(
    async () => {
        // Return a plain object so it maps cleanly out of unstable_cache across requests
        const userStorage: Record<string, number> = {};
        try {
            const fileSizes = new Map<string, number>();
            let isTruncated = true;
            let continuationToken: string | undefined = undefined;

            while (isTruncated) {
                const commandParams: any = { Bucket: R2_BUCKET_NAME };
                if (continuationToken) commandParams.ContinuationToken = continuationToken;

                const data = await r2Client.send(new ListObjectsV2Command(commandParams));
                if (data.Contents) {
                    for (const item of data.Contents) {
                        if (item.Key) fileSizes.set(item.Key, item.Size || 0);
                    }
                }
                isTruncated = data.IsTruncated ?? false;
                continuationToken = data.NextContinuationToken;
            }

            const voiceComments = await db.comment.findMany({
                where: { voiceUrl: { not: null }, authorId: { not: null } },
                select: { authorId: true, voiceUrl: true }
            });

            for (const comment of voiceComments) {
                if (!comment.authorId || !comment.voiceUrl) continue;
                const keyParts = comment.voiceUrl.split('/');
                const filename = keyParts[keyParts.length - 1];
                const r2Key = `voice/${filename}`;
                const size = fileSizes.get(r2Key) || 0;

                userStorage[comment.authorId] = (userStorage[comment.authorId] || 0) + size;
            }
        } catch (err) {
            console.error('Failed to parse user storage:', err);
        }
        return userStorage;
    },
    ['admin-user-voice-storage'],
    { revalidate: 600 }
);
