import Link from 'next/link';
import { notFound } from 'next/navigation';
import { 
  ArrowLeft, 
  Plus, 
  Settings, 
  Share2, 
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VideoCard } from '@/components/video-card';

// Mock data - will be replaced with real data
const mockProject = {
  id: '1',
  name: 'Product Demo v2',
  description: 'New product walkthrough video for Q1 launch',
  visibility: 'PRIVATE',
  videos: [
    {
      id: 'v1',
      title: 'Main Product Walkthrough',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      currentVersion: 3,
      commentCount: 12,
      duration: '5:42',
      lastUpdated: '2 hours ago',
    },
    {
      id: 'v2', 
      title: 'Feature Highlight - Dashboard',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      currentVersion: 1,
      commentCount: 5,
      duration: '2:18',
      lastUpdated: '1 day ago',
    },
    {
      id: 'v3',
      title: 'Onboarding Flow',
      thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      currentVersion: 2,
      commentCount: 8,
      duration: '3:55',
      lastUpdated: '3 days ago',
    },
  ],
};

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  
  // TODO: Fetch real project data
  const project = mockProject;
  
  if (!project) {
    notFound();
  }

  return (
    <div className="px-6 lg:px-8 py-8 w-full">
      {/* Back link */}
      <div className="mb-6">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Projects
        </Link>
      </div>

      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className="capitalize">
              {project.visibility.toLowerCase()}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button size="sm" asChild>
            <Link href={`/projects/${projectId}/videos/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Add Video
            </Link>
          </Button>
        </div>
      </div>

      {/* Videos Grid */}
      {project.videos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {project.videos.map((video) => (
            <VideoCard key={video.id} video={video} projectId={projectId} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No videos yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first video to start collecting feedback
            </p>
            <Button asChild>
              <Link href={`/projects/${projectId}/videos/new`}>
                <Plus className="h-4 w-4 mr-2" />
                Add Video
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
