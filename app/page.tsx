import Link from 'next/link';
import { Video, MessageSquare, Mic, Share2, ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="px-6 lg:px-8 flex h-16 items-center justify-between w-full">
          <Link href="/" className="flex items-center gap-2">
            <Video className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">OpenFrame</span>
          </Link>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <Button asChild variant="ghost">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 lg:px-8 py-24 md:py-32">
        <div className="flex flex-col items-center text-center gap-8 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Video feedback,{' '}
            <span className="text-primary">reimagined</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Collect timestamped feedback on your videos with text and voice comments.
            Share with your team and clients, iterate faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            {isLoggedIn ? (
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/register">
                  Start for free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg">
              <Link href="#features">
                <Play className="h-4 w-4 mr-2" />
                See how it works
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 lg:px-8 py-24 border-t">
        <h2 className="text-3xl font-bold text-center mb-16">
          Everything you need for video feedback
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={Video}
            title="Multiple Sources"
            description="Add videos from YouTube, Vimeo, or upload directly. One place for all your video content."
          />
          <FeatureCard
            icon={MessageSquare}
            title="Timestamped Comments"
            description="Leave feedback at specific moments. Click any comment to jump to that exact frame."
          />
          <FeatureCard
            icon={Mic}
            title="Voice Comments"
            description="Record voice notes for detailed feedback. Sometimes speaking is faster than typing."
          />
          <FeatureCard
            icon={Share2}
            title="Easy Sharing"
            description="Generate shareable links for clients and collaborators. No account required to comment."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 lg:px-8 py-24 border-t">
        <div className="bg-accent rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your video workflow?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join teams who have already switched to OpenFrame for faster, clearer video feedback.
          </p>
          <Button asChild size="lg">
            <Link href={isLoggedIn ? '/dashboard' : '/register'}>
              {isLoggedIn ? 'Go to Dashboard' : 'Get started for free'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <span className="font-semibold">OpenFrame</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built with Next.js, shadcn/ui, and ❤️
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-lg border bg-card">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}