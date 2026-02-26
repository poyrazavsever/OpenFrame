'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BunnyPreviewPlayerProps {
  providerVideoId: string | null;
  isProcessing: boolean;
}

export interface BunnyPreviewPlayerHandle {
  togglePlayPause: () => void;
  seekBy: (seconds: number) => void;
  toggleMute: () => void;
}

const DEFAULT_BUNNY_PULL_ZONE_HOSTNAME = 'vz-965f4f4a-fc1.b-cdn.net';

function resolveBunnyCdnHostname(): string {
  const configured = process.env.NEXT_PUBLIC_BUNNY_CDN_URL;
  if (!configured) return DEFAULT_BUNNY_PULL_ZONE_HOSTNAME;
  try {
    const parsed = new URL(configured);
    return parsed.hostname || DEFAULT_BUNNY_PULL_ZONE_HOSTNAME;
  } catch {
    return configured.replace(/^https?:\/\//, '').replace(/\/+$/, '') || DEFAULT_BUNNY_PULL_ZONE_HOSTNAME;
  }
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const BunnyPreviewPlayer = forwardRef<BunnyPreviewPlayerHandle, BunnyPreviewPlayerProps>(function BunnyPreviewPlayer({ providerVideoId, isProcessing }, ref) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const playlistUrl = useMemo(() => {
    if (!providerVideoId) return null;
    return `https://${resolveBunnyCdnHostname()}/${providerVideoId}/playlist.m3u8`;
  }, [providerVideoId]);
  const originalUrl = useMemo(() => {
    if (!providerVideoId) return null;
    return `https://${resolveBunnyCdnHostname()}/${providerVideoId}/original`;
  }, [providerVideoId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playlistUrl) return;

    let destroyed = false;
    let usingHlsJs = false;
    let sourceMode: 'hls' | 'original' = 'hls';

    const clearRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const scheduleRetry = (retryFn: () => void) => {
      clearRetry();
      retryTimerRef.current = setTimeout(() => {
        if (!destroyed) retryFn();
      }, 3000);
    };

    const getRetryUrl = (baseUrl: string) => {
      retryAttemptRef.current += 1;
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}retry=${Date.now()}-${retryAttemptRef.current}`;
    };
    const loadOriginal = (): boolean => {
      if (!originalUrl) return false;
      sourceMode = 'original';
      usingHlsJs = false;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.src = getRetryUrl(originalUrl);
      video.load();
      return true;
    };

    const onLoadedMetadata = () => {
      if (destroyed) return;
      setIsReady(true);
      setLoadError(false);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      clearRetry();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime || 0);
    const onError = () => {
      if (destroyed) return;
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        setLoadError(true);
        return;
      }
      setLoadError(false);
      if (sourceMode === 'hls' && loadOriginal()) {
        return;
      }
      scheduleRetry(() => {
        if (sourceMode === 'original' && originalUrl) {
          video.src = getRetryUrl(originalUrl);
          video.load();
        } else if (usingHlsJs && hlsRef.current) {
          hlsRef.current.loadSource(getRetryUrl(playlistUrl));
          hlsRef.current.startLoad(-1);
        } else {
          video.src = getRetryUrl(playlistUrl);
          video.load();
        }
      });
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('error', onError);

    const canPlayNativeHls = video.canPlayType('application/vnd.apple.mpegurl');
    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      usingHlsJs = true;
      sourceMode = 'hls';
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        if (!destroyed) hls.loadSource(playlistUrl);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (destroyed) return;
        if (data.fatal && video.readyState < HTMLMediaElement.HAVE_METADATA) {
          if (loadOriginal()) return;
          scheduleRetry(() => hls.loadSource(getRetryUrl(playlistUrl)));
        }
      });
    } else if (canPlayNativeHls) {
      sourceMode = 'hls';
      video.src = playlistUrl;
      video.load();
    } else {
      // Defer state update to avoid sync setState directly in effect body.
      window.setTimeout(() => {
        if (!destroyed) setLoadError(true);
      }, 0);
    }

    return () => {
      destroyed = true;
      clearRetry();
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('error', onError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
    };
  }, [playlistUrl, originalUrl]);

  const seekTo = (event: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    video.currentTime = ratio * duration;
    setCurrentTime(video.currentTime);
  };

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    if (video.paused) void video.play();
    else video.pause();
  }, [isReady]);

  const seekBy = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video || !isReady || !duration) return;
    video.currentTime = Math.min(duration, Math.max(0, (video.currentTime || 0) + seconds));
    setCurrentTime(video.currentTime);
  }, [duration, isReady]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  useImperativeHandle(ref, () => ({
    togglePlayPause,
    seekBy,
    toggleMute,
  }), [seekBy, toggleMute, togglePlayPause]);

  return (
    <div className="w-full h-full rounded-md border overflow-hidden bg-black flex flex-col">
      <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black" onClick={togglePlayPause}>
        <video ref={videoRef} className="w-full h-full object-contain bg-black" playsInline preload="metadata" />

        {(!isReady && !loadError) && (
          <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
            <div className="flex items-center gap-2 text-white text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isProcessing ? 'Processing...' : 'Loading...'}
            </div>
          </div>
        )}

        {loadError && !isProcessing && (
          <div className="absolute inset-0 bg-black/65 flex items-center justify-center">
            <p className="text-xs text-white/85">Unable to load Bunny preview right now.</p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/70 px-2 py-1.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:text-white"
            disabled={!isReady}
            onClick={togglePlayPause}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:text-white"
            disabled={!isReady}
            onClick={toggleMute}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          <span className="text-[11px] text-white/80 tabular-nums ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        <div
          className={cn(
            'relative h-6 rounded bg-white/10 select-none',
            isReady ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
          )}
          onClick={seekTo}
        >
          <div
            className="absolute left-0 top-0 h-full rounded bg-cyan-500/40 pointer-events-none"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
          <div
            className="absolute top-0 h-full w-1 rounded bg-cyan-400 pointer-events-none"
            style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 2px)` }}
          />
        </div>
      </div>
    </div>
  );
});
