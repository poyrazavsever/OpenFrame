import { auth } from '@/lib/auth';
import { apiErrors, successResponse, withCacheControl } from '@/lib/api-response';
import { getUserStorageInfo } from '@/lib/storage-quota';
import { hasBillingAccess } from '@/lib/billing';
import { db } from '@/lib/db';

// GET /api/settings/storage
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return apiErrors.unauthorized();
  }

  // Only users with active billing (or on a self-hosted instance where billing
  // is disabled) should be able to enumerate their storage breakdown.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      stripeCurrentPeriodEnd: true,
      billingAccessEndedAt: true,
    },
  });

  if (!user || !hasBillingAccess(user)) {
    return apiErrors.forbidden();
  }

  const info = await getUserStorageInfo(session.user.id);

  const response = successResponse({
    usedBytes: info.usedBytes.toString(),
    limitBytes: info.limitBytes.toString(),
    percentage: info.percentage,
  });

  // Cache for 60s — stale data is acceptable for a usage meter
  return withCacheControl(response, 'private, max-age=60');
}
