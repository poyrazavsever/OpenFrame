'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  Maximize,
  MessageSquare,
  Mic,
  Send,
  Clock,
  CheckCircle2,
  Circle,
  ChevronDown,
  MoreVertical,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

// Mock data
const mockVideo = {
  id: 'v1',
  title: 'Main Product Walkthrough',
  description: 'Complete walkthrough of the new product features',
  projectId: '1',
  projectName: 'Product Demo v2',
  versions: [
    { id: 'ver3', number: 3, label: 'Final Cut', isActive: true },
    { id: 'ver2', number: 2, label: 'Review Round 2', isActive: false },
    { id: 'ver1', number: 1, label: 'First Draft', isActive: false },
  ],
  currentVersion: {
    id: 'ver3',
    number: 3,
    label: 'Final Cut',
    providerId: 'youtube',
    videoId: 'dQw4w9WgXcQ', // Sample video
    duration: 342, // 5:42
  },
};

const mockComments = [
  {
    id: 'c1',
    content: 'The transition here feels a bit abrupt. Can we add a fade?',
    timestamp: 45.5,
    author: { name: 'Sarah Chen', image: null },
    createdAt: '2 hours ago',
    isResolved: false,
    replies: [
      {
        id: 'c1r1',
        content: 'Good catch! I\'ll smooth that out in the next version.',
        author: { name: 'Mike Johnson', image: null },
        createdAt: '1 hour ago',
      },
    ],
  },
  {
    id: 'c2',
    content: 'Love this section! The pacing is perfect.',
    timestamp: 120,
    author: { name: 'Alex Rivera', image: null },
    createdAt: '5 hours ago',
    isResolved: true,
    replies: [],
  },
  {
    id: 'c3',
    content: 'Can we add some background music here?',
    timestamp: 200,
    voiceUrl: '/mock-voice.mp3', // Mock voice comment
    voiceDuration: 8.5,
    author: { name: 'Jordan Lee', image: null },
    createdAt: '1 day ago',
    isResolved: false,
    replies: [],
  },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function VideoPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const videoId = params.videoId as string;
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(mockVideo.currentVersion.duration);
  const [isMuted, setIsMuted] = useState(false);
  
  const [commentText, setCommentText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null);
  const [comments, setComments] = useState(mockComments);
  const [showResolved, setShowResolved] = useState(false);

  const filteredComments = comments.filter(c => showResolved || !c.isResolved);

  const handleSeekToTimestamp = useCallback((timestamp: number) => {
    setCurrentTime(timestamp);
    // In real implementation, control iframe player
    // window.postMessage to YouTube iframe API
  }, []);

  const handleAddComment = useCallback(() => {
    if (!commentText.trim() && !isRecording) return;
    
    const newComment = {
      id: `c${Date.now()}`,
      content: commentText,
      timestamp: selectedTimestamp ?? currentTime,
      author: { name: 'You', image: null },
      createdAt: 'Just now',
      isResolved: false,
      replies: [],
    };
    
    setComments(prev => [...prev, newComment]);
    setCommentText('');
    setSelectedTimestamp(null);
  }, [commentText, currentTime, selectedTimestamp, isRecording]);

  const handleResolveComment = useCallback((commentId: string) => {
    setComments(prev => prev.map(c => 
      c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
    ));
  }, []);

  const embedUrl = `https://www.youtube.com/embed/${mockVideo.currentVersion.videoId}?enablejsapi=1&rel=0&modestbranding=1`;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Main Content - Full Width Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Compact Header Bar */}
          <div className="shrink-0 flex items-center justify-between h-12 px-4 border-b bg-background/50">
            <div className="flex items-center gap-3">
              <Link 
                href={`/projects/${projectId}`}
                className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
              <Separator orientation="vertical" className="h-5" />
              <div className="min-w-0">
                <span className="text-sm font-medium">{mockVideo.title}</span>
                <span className="text-xs text-muted-foreground ml-2">• {mockVideo.projectName}</span>
              </div>
            </div>
            
            {/* Version Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Badge variant="secondary" className="mr-2">v{mockVideo.currentVersion.number}</Badge>
                  {mockVideo.currentVersion.label}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {mockVideo.versions.map((version) => (
                  <DropdownMenuItem key={version.id}>
                    <Badge variant={version.isActive ? 'default' : 'secondary'} className="mr-2">
                      v{version.number}
                    </Badge>
                    {version.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Video Player - Maximized */}
          <div className="flex-1 bg-black flex items-center justify-center p-2">
            <div className="relative w-full h-full max-h-full">
              <iframe
                ref={iframeRef}
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
          
          {/* Timeline with comment markers */}
          <div className="shrink-0 px-4 py-2 bg-background border-t">
            <div className="relative h-8 bg-muted rounded cursor-pointer">
              {/* Progress bar */}
              <div 
                className="absolute left-0 top-0 h-full bg-primary/30 rounded"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              
              {/* Comment markers */}
              {comments.map((comment) => (
                <button
                  key={comment.id}
                  onClick={() => handleSeekToTimestamp(comment.timestamp)}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-transform hover:scale-150 z-10",
                    comment.isResolved ? "bg-green-500" : "bg-primary"
                  )}
                  style={{ left: `${(comment.timestamp / duration) * 100}%` }}
                  title={`${formatTime(comment.timestamp)} - ${comment.content?.substring(0, 30)}...`}
                />
              ))}
              
              {/* Time display */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </div>

        {/* Comments Sidebar - Fixed Right */}
        <div className="w-80 shrink-0 border-l bg-card flex flex-col overflow-hidden">
          {/* Comments Header */}
          <div className="shrink-0 flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <span className="font-medium">Comments</span>
              <Badge variant="secondary">{comments.length}</Badge>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? 'Hide' : 'Show'} Resolved
            </Button>
          </div>

          {/* Comments List - Scrollable */}
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
                .map((comment) => (
                  <div 
                    key={comment.id} 
                    className={cn(
                      "group rounded-lg border p-3 transition-colors hover:bg-accent/50",
                      comment.isResolved && "opacity-60"
                    )}
                  >
                    {/* Comment Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={comment.author.image ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {comment.author.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{comment.author.name}</span>
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
                          onClick={() => handleResolveComment(comment.id)}
                        >
                          {comment.isResolved ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Reply</DropdownMenuItem>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Comment Content */}
                    {comment.content && (
                      <p className="text-sm mb-2">{comment.content}</p>
                    )}
                    
                    {/* Voice Comment */}
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
                    
                    {/* Timestamp & Meta */}
                    <p className="text-xs text-muted-foreground">{comment.createdAt}</p>

                    {/* Replies */}
                    {comment.replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 space-y-2">
                        {comment.replies.map((reply) => (
                          <div key={reply.id} className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-xs">
                                  {reply.author.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-xs">{reply.author.name}</span>
                              <span className="text-xs text-muted-foreground">{reply.createdAt}</span>
                            </div>
                            <p className="text-sm">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>

          {/* Comment Input - Fixed at Bottom */}
          <div className="shrink-0 p-4 border-t bg-background">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTimestamp(currentTime)}
                className={cn(selectedTimestamp !== null && "border-primary")}
              >
                <Clock className="h-4 w-4 mr-1" />
                {selectedTimestamp !== null 
                  ? formatTime(selectedTimestamp)
                  : formatTime(currentTime)
                }
              </Button>
              <span className="text-xs text-muted-foreground">
                Pin to this time
              </span>
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
                  disabled={!commentText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant={isRecording ? "destructive" : "outline"}
                  onClick={() => setIsRecording(!isRecording)}
                >
                  <Mic className={cn("h-4 w-4", isRecording && "animate-pulse")} />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ⌘+Enter to submit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
