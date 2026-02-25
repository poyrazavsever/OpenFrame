import type { BunnyCleanupResult } from '@/lib/bunny-stream-cleanup';
import type { R2CleanupResult } from '@/lib/r2-cleanup';

interface CleanupWarningSummary {
  attempted: number;
  failed: number;
}

export interface CleanupWarnings {
  bunny?: CleanupWarningSummary;
  r2?: CleanupWarningSummary;
}

export function buildCleanupWarnings(input: {
  bunny?: BunnyCleanupResult;
  r2?: R2CleanupResult;
}): CleanupWarnings | undefined {
  const warnings: CleanupWarnings = {};

  if (input.bunny && input.bunny.failed > 0) {
    warnings.bunny = {
      attempted: input.bunny.attempted,
      failed: input.bunny.failed,
    };
  }

  if (input.r2 && input.r2.failed > 0) {
    warnings.r2 = {
      attempted: input.r2.attempted,
      failed: input.r2.failed,
    };
  }

  return Object.keys(warnings).length > 0 ? warnings : undefined;
}

export function logCleanupWarnings(
  context: { entityType: string; entityId: string },
  input: { bunny?: BunnyCleanupResult; r2?: R2CleanupResult }
): void {
  if (input.bunny && input.bunny.failed > 0) {
    console.error('External cleanup warning', {
      entityType: context.entityType,
      entityId: context.entityId,
      provider: 'bunny',
      operation: 'delete',
      attempted: input.bunny.attempted,
      failed: input.bunny.failed,
      failedIds: input.bunny.failedIds.slice(0, 10),
    });
  }

  if (input.r2 && input.r2.failed > 0) {
    console.error('External cleanup warning', {
      entityType: context.entityType,
      entityId: context.entityId,
      provider: 'r2',
      operation: 'delete',
      attempted: input.r2.attempted,
      failed: input.r2.failed,
      failedKeys: input.r2.failedKeys.slice(0, 10),
    });
  }
}
