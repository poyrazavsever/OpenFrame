import { runWithConcurrency } from '@/lib/async-pool';

interface BunnyVideoRef {
  providerId: string;
  videoId: string;
}

const BUNNY_API_BASE = 'https://video.bunnycdn.com';
const BUNNY_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const BUNNY_DELETE_CONCURRENCY = 5;

function getBunnyConfig(): { apiKey: string; libraryId: string } {
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID || process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID;

  if (!apiKey || !libraryId) {
    throw new Error('Bunny cleanup failed: missing BUNNY_STREAM_API_KEY or BUNNY_STREAM_LIBRARY_ID.');
  }

  return { apiKey, libraryId };
}

export async function cleanupBunnyStreamVideos(videoRefs: BunnyVideoRef[]): Promise<void> {
  const normalizeVideoId = (value: string): string | null => {
    const trimmed = value.trim();
    return BUNNY_VIDEO_ID_PATTERN.test(trimmed) ? trimmed : null;
  };

  const bunnyVideoIds = [...new Set(
    videoRefs
      .filter((ref) => ref.providerId === 'bunny' && Boolean(ref.videoId))
      .map((ref) => normalizeVideoId(ref.videoId))
      .filter((videoId): videoId is string => Boolean(videoId))
  )];

  if (bunnyVideoIds.length === 0) return;

  const { apiKey, libraryId } = getBunnyConfig();
  const failures: Array<{ videoId: string; status: number; bodySnippet: string }> = [];

  await runWithConcurrency(bunnyVideoIds, BUNNY_DELETE_CONCURRENCY, async (bunnyVideoId) => {
    const response = await fetch(`${BUNNY_API_BASE}/library/${libraryId}/videos/${encodeURIComponent(bunnyVideoId)}`, {
      method: 'DELETE',
      headers: {
        AccessKey: apiKey,
      },
    });

    // Treat not-found as already deleted.
    if (response.status === 404) return;

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      failures.push({
        videoId: bunnyVideoId,
        status: response.status,
        bodySnippet: body.slice(0, 300),
      });
    }
  });

  if (failures.length > 0) {
    const preview = failures
      .slice(0, 3)
      .map((failure) => `${failure.videoId} (${failure.status})`)
      .join(', ');
    throw new Error(`Bunny cleanup failed for ${failures.length} video(s): ${preview}`);
  }
}
