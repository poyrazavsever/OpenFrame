import { auth } from '@/lib/auth';
import { apiErrors, successResponse } from '@/lib/api-response';
import { refreshR2StorageSnapshot } from '@/lib/admin-stats';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return apiErrors.forbidden('Admin access required');
    }

    const refreshedAt = await refreshR2StorageSnapshot();

    return successResponse({
      ok: true,
      refreshedAt,
    });
  } catch (error) {
    console.error('Error refreshing R2 admin stats cache:', error);
    return apiErrors.internalError('Failed to refresh R2 stats');
  }
}
