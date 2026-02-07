import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2';
import { db } from '@/lib/db';

/** The path prefix for audio URLs served by the upload API. */
const AUDIO_PATH_PREFIX = '/api/upload/audio/';

/**
 * Extract the R2 object key from a voice URL like /api/upload/audio/filename.webm.
 * Uses string parsing instead of regex to avoid ReDoS risk on untrusted input.
 */
function voiceUrlToKey(url: string): string | null {
    const idx = url.indexOf(AUDIO_PATH_PREFIX);
    if (idx === -1) return null;
    const filename = url.slice(idx + AUDIO_PATH_PREFIX.length);
    return filename ? `voice/${filename}` : null;
}

/**
 * Delete a list of voice files from R2 (best-effort, logs failures).
 */
async function deleteVoiceFiles(voiceUrls: string[]) {
    for (const url of voiceUrls) {
        try {
            const key = voiceUrlToKey(url);
            if (key) {
                await r2Client.send(
                    new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
                );
            }
        } catch (err) {
            console.error('Failed to delete audio from R2:', err);
        }
    }
}

/**
 * Collect all voice URLs from comments under a given video (all versions).
 */
export async function collectVideoVoiceUrls(videoId: string): Promise<string[]> {
    const comments = await db.comment.findMany({
        where: {
            voiceUrl: { not: null },
            version: { videoParentId: videoId },
        },
        select: { voiceUrl: true },
    });
    return comments.map((c) => c.voiceUrl).filter(Boolean) as string[];
}

/**
 * Collect all voice URLs from comments under all videos in a project.
 */
export async function collectProjectVoiceUrls(projectId: string): Promise<string[]> {
    const comments = await db.comment.findMany({
        where: {
            voiceUrl: { not: null },
            version: { video: { projectId } },
        },
        select: { voiceUrl: true },
    });
    return comments.map((c) => c.voiceUrl).filter(Boolean) as string[];
}

/**
 * Collect all voice URLs from comments under all projects in a workspace.
 */
export async function collectWorkspaceVoiceUrls(workspaceId: string): Promise<string[]> {
    const comments = await db.comment.findMany({
        where: {
            voiceUrl: { not: null },
            version: { video: { project: { workspaceId } } },
        },
        select: { voiceUrl: true },
    });
    return comments.map((c) => c.voiceUrl).filter(Boolean) as string[];
}

/**
 * Delete all voice files for a video from R2.
 * Call BEFORE deleting the video from the database (cascade would remove comment rows).
 */
export async function cleanupVideoVoiceFiles(videoId: string) {
    const urls = await collectVideoVoiceUrls(videoId);
    await deleteVoiceFiles(urls);
}

/**
 * Delete all voice files for a project from R2.
 * Call BEFORE deleting the project from the database.
 */
export async function cleanupProjectVoiceFiles(projectId: string) {
    const urls = await collectProjectVoiceUrls(projectId);
    await deleteVoiceFiles(urls);
}

/**
 * Delete all voice files for a workspace from R2.
 * Call BEFORE deleting the workspace from the database.
 */
export async function cleanupWorkspaceVoiceFiles(workspaceId: string) {
    const urls = await collectWorkspaceVoiceUrls(workspaceId);
    await deleteVoiceFiles(urls);
}
