import type { VideoProvider, VideoMetadata, EmbedOptions, ThumbnailSize } from './types';

// Direct video URL patterns (for future self-hosted videos)
const DIRECT_VIDEO_PATTERNS = [
  /\.(mp4|webm|ogg|mov)(\?.*)?$/i,
];

export const directProvider: VideoProvider = {
  id: 'direct',
  name: 'Direct Upload',
  icon: 'Upload',

  canHandle(url: string): boolean {
    // Check for common video extensions or our own domain
    return DIRECT_VIDEO_PATTERNS.some(pattern => pattern.test(url));
  },

  extractVideoId(url: string): string | null {
    // For direct uploads, the "videoId" is the full URL
    // In production, this would be a storage key/path
    if (this.canHandle(url)) {
      return url;
    }
    return null;
  },

  getEmbedUrl(videoId: string, options: EmbedOptions = {}): string {
    // For direct videos, we'll use HTML5 video player
    // The videoId IS the URL for direct uploads
    const params = new URLSearchParams();
    
    if (options.startTime) params.set('t', String(Math.floor(options.startTime)));
    
    const queryString = params.toString();
    return `${videoId}${queryString ? `#t=${options.startTime}` : ''}`;
  },

  getThumbnailUrl(videoId: string, size: ThumbnailSize = 'medium'): string {
    // For direct uploads, thumbnail would be generated server-side
    // Return a placeholder for now
    return '/placeholder-video-thumbnail.png';
  },

  async getMetadata(videoId: string): Promise<VideoMetadata> {
    // For direct uploads, metadata would be stored in our database
    // This is a placeholder implementation
    const filename = videoId.split('/').pop() || 'Video';
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    return {
      title: nameWithoutExt,
      thumbnailUrl: this.getThumbnailUrl(videoId),
    };
  },
};
