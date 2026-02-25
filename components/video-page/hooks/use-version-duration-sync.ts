'use client';

import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { VideoData } from '@/components/video-page/types';

interface UseVersionDurationSyncParams {
  videoDuration: number;
  activeVersionDuration?: number | null;
  activeVersionId: string | null;
  propProjectId?: string;
  videoId: string;
  setVideo: Dispatch<SetStateAction<VideoData | null>>;
}

export function useVersionDurationSync({
  videoDuration,
  activeVersionDuration,
  activeVersionId,
  propProjectId,
  videoId,
  setVideo,
}: UseVersionDurationSyncParams) {
  useEffect(() => {
    if (!videoDuration || !activeVersionId || !propProjectId) return;
    if (activeVersionDuration && activeVersionDuration > 0) return;

    const roundedDuration = Math.round(videoDuration);
    fetch(`/api/projects/${propProjectId}/videos/${videoId}/versions/${activeVersionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration: roundedDuration }),
    }).catch(() => {
      // ignore save errors
    });

    setVideo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        versions: prev.versions.map((v) =>
          v.id === activeVersionId ? { ...v, duration: roundedDuration } : v
        ),
      };
    });
  }, [videoDuration, activeVersionDuration, activeVersionId, propProjectId, videoId, setVideo]);
}
