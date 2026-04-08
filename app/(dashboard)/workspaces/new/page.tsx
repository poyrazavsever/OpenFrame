import { requireAuthOrRedirect } from '@/lib/route-access';
import { getBillingOverview } from '@/lib/billing';
import NewWorkspacePageClient from './new-workspace-page-client';

export default async function NewWorkspacePage() {
  const session = await requireAuthOrRedirect();
  if (!session?.user?.id) {
    return null;
  }

  const billing = await getBillingOverview(session.user.id);

  return <NewWorkspacePageClient workspaceCreation={billing.workspaceCreation} />;
}
