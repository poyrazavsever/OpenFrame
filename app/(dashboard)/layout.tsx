import { Header } from '@/components/layout';
// import { auth } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Uncomment when database is set up
  // const session = await auth();
  const mockUser = {
    name: 'Demo User',
    email: 'demo@openframe.dev',
    image: null,
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header user={mockUser} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
