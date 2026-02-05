'use client';

import Link from 'next/link';
import { 
  Play,
  MessageSquare,
  Clock,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    thumbnailUrl: string;
    currentVersion: number;
    commentCount: number;
    duration: string;
    lastUpdated: string;
  };
  projectId: string;
}

export function VideoCard({ video, projectId }: VideoCardProps) {
  return (
    <Card className="group overflow-hidden transition-colors hover:bg-accent/50 cursor-pointer">
      <Link href={`/watch/${video.id}`}>
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted overflow-hidden">
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="object-cover w-full h-full transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="h-12 w-12 text-white" fill="white" />
          </div>
          <Badge className="absolute bottom-2 right-2 bg-black/70">
            {video.duration}
          </Badge>
        </div>
      </Link>
      
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/watch/${video.id}`} className="min-w-0 flex-1">
            <h3 className="font-medium truncate">{video.title}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">
                  v{video.currentVersion}
                </Badge>
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {video.commentCount}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {video.lastUpdated}
              </span>
            </div>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Edit</DropdownMenuItem>
              <DropdownMenuItem>Add Version</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
