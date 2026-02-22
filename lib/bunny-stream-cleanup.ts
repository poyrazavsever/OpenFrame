interface BunnyVideoRef {
  providerId: string;
  videoId: string;
}

const BUNNY_API_BASE = 'https://video.bunnycdn.com';
const BUNNY_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

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

  for (const bunnyVideoId of bunnyVideoIds) {
    const response = await fetch(`${BUNNY_API_BASE}/library/${libraryId}/videos/${encodeURIComponent(bunnyVideoId)}`, {
      method: 'DELETE',
      headers: {
        AccessKey: apiKey,
      },
    });

    // Treat not-found as already deleted.
    if (response.status === 404) continue;

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Bunny cleanup failed for video ${bunnyVideoId}: ${response.status} ${body.slice(0, 300)}`
      );
    }
  }
}
