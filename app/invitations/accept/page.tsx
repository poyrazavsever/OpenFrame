import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { acceptInvitationTokenForUser } from '@/lib/invitations';

interface InvitationAcceptPageProps {
  searchParams: Promise<{
    token?: string;
    email?: string;
  }>;
}

export default async function InvitationAcceptPage({ searchParams }: InvitationAcceptPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token?.trim();

  if (!token) {
    redirect('/login?error=invalid_invitation');
  }

  const session = await auth();
  if (!session?.user?.id) {
    const callbackUrl = `/invitations/accept?token=${encodeURIComponent(token)}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const invitation = await db.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      status: true,
      scope: true,
      workspaceId: true,
      projectId: true,
    },
  });

  function redirectToInvitationTarget(inviteStatus: string) {
    if (invitation?.scope === 'WORKSPACE' && invitation.workspaceId) {
      redirect(`/workspaces/${invitation.workspaceId}?invite=${inviteStatus}`);
    }
    if (invitation?.scope === 'PROJECT' && invitation.projectId) {
      redirect(`/projects/${invitation.projectId}?invite=${inviteStatus}`);
    }
  }

  const userEmail = session.user.email?.toLowerCase().trim();
  if (!userEmail) {
    redirect('/dashboard?invite=invalid_email');
  }

  const result = await acceptInvitationTokenForUser({
    token,
    userId: session.user.id,
    email: userEmail,
  });

  if (result === 'accepted') {
    redirectToInvitationTarget('accepted');
    redirect('/dashboard?invite=accepted');
  }
  if (result === 'expired') {
    redirectToInvitationTarget('expired');
    redirect('/dashboard?invite=expired');
  }
  if (result === 'forbidden') {
    redirect('/dashboard?invite=wrong_account');
  }

  if (result === 'not_found' && invitation?.status === 'ACCEPTED') {
    redirectToInvitationTarget('already_accepted');
  }

  redirect('/dashboard?invite=not_found');
}
