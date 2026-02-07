'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MessageSquare,
  Mic,
  Send,
  Clock,
  CheckCircle2,
  Circle,
  ChevronDown,
  MoreVertical,
  SkipBack,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Version {
  id: string;
  versionNumber: number;
  versionLabel: string | null;
  providerId: string;
  videoId: string;
  originalUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  isActive: boolean;
  _count: { comments: number };
}

interface Comment {
  id: string;
  content: string | null;
  timestamp: number;
  voiceUrl: string | null;
  voiceDuration: number | null;
  isResolved: boolean;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null } | null;
  guestName: string | null;
  replies: {
    id: string;
    content: string | null;
    createdAt: string;
    author: { id: string; name: string | null; image: string | null } | null;
    guestName: string | null;
  }[];
}

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  projectId: string;
  project: {
    name: string;
    ownerId: string;
    members: { role: string }[];
  };
  versions: (Version & { comments: Comment[] })[];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function WatchPage() {
  const params = useParams();
  const videoId = params.videoId as string;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  // Fetch video data
  useEffect(() => {
    async function fetchVideo() {
      try {
        const res = await fetch(`/api/watch/${videoId}`);
        if (!res.ok) {
          setError('Video not found or access denied');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setVideo(data);
        const active = data.versions.find((v: Version) => v.isActive) || data.versions[0];
        if (active) setActiveVersionId(active.id);
      } catch {
        setError('Failed to load video');
      } finally {
        setLoading(false);
      }
    }
    fetchVideo();
  }, [videoId]);

  const activeVersion = video?.versions.find((v) => v.id === activeVersionId);
  const comments = activeVersion?.comments || [];
  const filteredComments = comments.filter((c) => showResolved || !c.isResolved);
  const duration = activeVersion?.duration || 300;

  // Load YouTube iframe API
  useEffect(() => {
    if (!activeVersion || activeVersion.providerId !== 'youtube') return;

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!iframeRef.current) return;
      playerRef.current = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => setIsReady(true),
          onStateChange: (event: YT.OnStateChangeEvent) => {
            setIsPlaying(event.data === YT.PlayerState.PLAYING);
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      window.onYouTubeIframeAPIReady = undefined;
    };
  }, [activeVersion]);

  // Update current time periodically
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime && !isDragging) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isReady, isDragging]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

  const handleSeekToTimestamp = useCallback((timestamp: number) => {
    setCurrentTime(timestamp);
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(timestamp, true);
    }
  }, []);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * duration;
      handleSeekToTimestamp(newTime);
    },
    [duration, handleSeekToTimestamp]
  );

  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      handleTimelineClick(e);
    },
    [handleTimelineClick]
  );

  const handleTimelineMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging || !timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const newTime = percentage * duration;
      setCurrentTime(newTime);
    },
    [isDragging, duration]
  );

  const handleTimelineMouseUp = useCallback(() => {
    if (isDragging) {
      handleSeekToTimestamp(currentTime);
      setIsDragging(false);
    }
  }, [isDragging, currentTime, handleSeekToTimestamp]);

  const handleMuteToggle = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
    } else {
      playerRef.current.mute();
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleSkip = useCallback(
    (seconds: number) => {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      handleSeekToTimestamp(newTime);
    },
    [currentTime, duration, handleSeekToTimestamp]
  );

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || !activeVersion) return;
    setIsSubmittingComment(true);

    try {
      const res = await fetch(`/api/versions/${activeVersion.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText,
          timestamp: selectedTimestamp ?? currentTime,
        }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setVideo((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            versions: prev.versions.map((v) =>
              v.id === activeVersionId
                ? { ...v, comments: [...v.comments, { ...newComment, replies: newComment.replies || [] }] }
                : v
            ),
          };
        });
        setCommentText('');
        setSelectedTimestamp(null);
      }
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentText, currentTime, selectedTimestamp, activeVersion, activeVersionId]);

  const handleResolveComment = useCallback(
    async (commentId: string, currentlyResolved: boolean) => {
      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isResolved: !currentlyResolved }),
        });

        if (res.ok) {
          setVideo((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              versions: prev.versions.map((v) =>
                v.id === activeVersionId
                  ? {
                      ...v,
                      comments: v.comments.map((c) =>
                        c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
                      ),
                    }
                  : v
              ),
            };
          });
        }
      } catch (err) {
        console.error('Failed to resolve comment:', err);
      }
    },
    [activeVersionId]
  );

  const getEmbedUrl = (version: Version) => {
    if (version.providerId === 'youtube') {
      return `https://www.youtube.com/embed/${version.videoId}?enablejsapi=1&rel=0&modestbranding=1&controls=0&showinfo=0&iv_load_policy=3&disablekb=1`;
    }
    if (version.providerId === 'vimeo') {
      return `https://player.vimeo.com/video/${version.videoId}`;
    }
    return version.originalUrl;
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !video || !activeVersion) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">{error || 'Video not found'}</p>
          <Button asChild variant="outline">
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const embedUrl = getEmbedUrl(activeVersion);

  return (
    <div
      className="h-screen flex flex-col bg-background overflow-hidden"
      onMouseUp={handleTimelineMouseUp}
      onMouseLeave={() => isDragging && handleTimelineMouseUp()}
    >
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Compact Header Bar */}
          <div className="shrink-0 flex items-center justify-between h-12 px-4 border-b bg-background/50">
            <div className="flex items-center gap-3">
              <Link
                href={`/projects/${video.projectId}`}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
              <Separator orientation="vertical" className="h-5" />
              <div className="min-w-0">
                <span className="text-sm font-medium">{video.title}</span>
                <span className="text-xs text-muted-foreground ml-2">• {video.project.name}</span>
              </div>
            </div>

            {/* Version Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Badge variant="secondary" className="mr-2">
                    v{activeVersion.versionNumber}
                  </Badge>
                  {activeVersion.versionLabel || `Version ${activeVersion.versionNumber}`}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {video.versions.map((version) => (
                  <DropdownMenuItem
                    key={version.id}
                    onClick={() => setActiveVersionId(version.id)}
                  >
                    <Badge
                      variant={version.id === activeVersionId ? 'default' : 'secondary'}
                      className="mr-2"
                    >
                      v{version.versionNumber}
                    </Badge>
                    {version.versionLabel || `Version ${version.versionNumber}`}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {version._count.comments} comments
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Video Player - Maximized */}
          <div
            className="flex-1 bg-black flex items-center justify-center relative cursor-pointer group"
            onClick={handlePlayPause}
          >
            <div className="relative w-full h-full">
              <iframe
                ref={iframeRef}
                src={embedUrl}
                className="absolute inset-0 w-full h-full pointer-events-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />

              {/* Play/Pause overlay indicator */}
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity',
                  isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
                )}
              >
                <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
                  {isPlaying ? (
                    <Pause className="h-8 w-8 text-white" />
                  ) : (
                    <Play className="h-8 w-8 text-white ml-1" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Custom Controls Bar */}
          <div className="shrink-0 px-4 py-3 bg-background border-t">
            {/* Control buttons */}
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePlayPause}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleSkip(-10)}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleSkip(10)}
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleMuteToggle}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>

              <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Timeline with comment markers */}
            <div
              ref={timelineRef}
              className="relative h-8 bg-muted rounded cursor-pointer select-none"
              onMouseDown={handleTimelineMouseDown}
              onMouseMove={handleTimelineMouseMove}
            >
              {/* Progress bar */}
              <div
                className="absolute left-0 top-0 h-full bg-primary/30 rounded pointer-events-none"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />

              {/* Playhead */}
              <div
                className="absolute top-0 h-full w-1 bg-primary rounded pointer-events-none"
                style={{ left: `calc(${(currentTime / duration) * 100}% - 2px)` }}
              />

              {/* Comment markers */}
              {comments.map((comment) => (
                <button
                  key={comment.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSeekToTimestamp(comment.timestamp);
                  }}
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-transform hover:scale-150 z-10',
                    comment.isResolved ? 'bg-green-500' : 'bg-cyan-400'
                  )}
                  style={{ left: `calc(${(comment.timestamp / duration) * 100}% - 6px)` }}
                  title={`${formatTime(comment.timestamp)} - ${comment.content?.substring(0, 30)}...`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Comments Sidebar */}
        <div className="w-80 shrink-0 border-l bg-card flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <span className="font-medium">Comments</span>
              <Badge variant="secondary">{comments.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowResolved(!showResolved)}>
              {showResolved ? 'Hide' : 'Show'} Resolved
            </Button>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredComments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No comments yet</p>
                <p className="text-sm">Be the first to leave feedback!</p>
              </div>
            ) : (
              filteredComments
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((comment) => {
                  const authorName =
                    comment.author?.name || comment.guestName || 'Anonymous';
                  return (
                    <div
                      key={comment.id}
                      className={cn(
                        'group rounded-lg border p-3 transition-colors hover:bg-accent/50',
                        comment.isResolved && 'opacity-60'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={comment.author?.image ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {authorName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{authorName}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSeekToTimestamp(comment.timestamp)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/10"
                          >
                            <Clock className="h-3 w-3" />
                            {formatTime(comment.timestamp)}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              handleResolveComment(comment.id, comment.isResolved)
                            }
                          >
                            {comment.isResolved ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Reply</DropdownMenuItem>
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {comment.content && <p className="text-sm mb-2">{comment.content}</p>}

                      {comment.voiceUrl && (
                        <div className="flex items-center gap-2 p-2 bg-muted rounded mb-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Play className="h-4 w-4" />
                          </Button>
                          <div className="flex-1 h-1 bg-primary/30 rounded">
                            <div className="w-0 h-full bg-primary rounded" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(comment.voiceDuration || 0)}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </p>

                      {comment.replies.length > 0 && (
                        <div className="mt-3 pl-3 border-l-2 space-y-2">
                          {comment.replies.map((reply) => {
                            const replyAuthor =
                              reply.author?.name || reply.guestName || 'Anonymous';
                            return (
                              <div key={reply.id} className="text-sm">
                                <div className="flex items-center gap-2 mb-1">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-xs">
                                      {replyAuthor.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-xs">{replyAuthor}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(reply.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="text-sm">{reply.content}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>

          {/* Comment Input */}
          <div className="shrink-0 p-4 border-t bg-background">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTimestamp(currentTime)}
                className={cn(selectedTimestamp !== null && 'border-primary')}
              >
                <Clock className="h-4 w-4 mr-1" />
                {selectedTimestamp !== null ? formatTime(selectedTimestamp) : formatTime(currentTime)}
              </Button>
              <span className="text-xs text-muted-foreground">Pin to this time</span>
            </div>

            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleAddComment();
                  }
                }}
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="icon"
                  onClick={handleAddComment}
                  disabled={!commentText.trim() || isSubmittingComment}
                >
                  {isSubmittingComment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant={isRecording ? 'destructive' : 'outline'}
                  onClick={() => setIsRecording(!isRecording)}
                >
                  <Mic className={cn('h-4 w-4', isRecording && 'animate-pulse')} />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cmd+Enter to submit</p>
          </div>
        </div>
      </div>
    </div>
  );
}