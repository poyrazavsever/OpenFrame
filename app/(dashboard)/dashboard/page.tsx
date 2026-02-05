import Link from 'next/link';
import { Plus, FolderOpen, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
// import { auth } from '@/lib/auth';
// import { redirect } from 'next/navigation';

// Placeholder data - will be replaced with real data from database
const mockProjects = [
  {
    id: '1',
    name: 'Product Demo v2',
    description: 'New product walkthrough video for Q1 launch',
    videoCount: 3,
    lastUpdated: '2 hours ago',
    memberCount: 4,
  },
  {
    id: '2', 
    name: 'Marketing Campaign',
    description: 'Social media ads for summer campaign',
    videoCount: 8,
    lastUpdated: '1 day ago',
    memberCount: 2,
  },
  {
    id: '3',
    name: 'Tutorial Series',
    description: 'Getting started tutorials for new users',
    videoCount: 12,
    lastUpdated: '3 days ago',
    memberCount: 1,
  },
];

export default async function DashboardPage() {
  // TODO: Uncomment when database is set up
  // const session = await auth();
  // if (!session) {
  //   redirect('/login');
  // }

  return (
    <div className="px-6 lg:px-8 py-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your video projects and collect feedback
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Projects Grid */}
      {mockProjects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    {project.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {project.lastUpdated}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {project.memberCount}
                    </span>
                    <span>{project.videoCount} videos</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first project to start collecting video feedback
            </p>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
