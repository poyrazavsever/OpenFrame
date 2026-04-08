import { hasCollaboratorBillingBackedAccess, requireAuthOrRedirect } from '@/lib/route-access';
import { getBillingOverview } from '@/lib/billing';
import SettingsPageClient from './settings-page-client';

export default async function SettingsPage() {
  const session = await requireAuthOrRedirect();
  if (!session?.user?.id) {
    return null;
  }

  const [billing, hasCollaboratorAccess] = await Promise.all([
    getBillingOverview(session.user.id),
    hasCollaboratorBillingBackedAccess(session.user.id),
  ]);

  return (
    <SettingsPageClient
      billingOnly={!billing.subscription.hasBillingAccess && !hasCollaboratorAccess}
    />
  );
}
