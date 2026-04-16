/**
 * One-off backfill: populate size_bytes on existing VideoAsset rows (R2_IMAGE, R2_AUDIO)
 * that still have the default value of 0.
 *
 * Run with:
 *   bun scripts/backfill-asset-sizes.ts
 *
 * Dry-run (no writes):
 *   bun scripts/backfill-asset-sizes.ts --dry-run
 */
import 'dotenv/config';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { db, disconnectDb } from '../lib/db';
import { r2Client, R2_BUCKET_NAME } from '../lib/r2';
import { runWithConcurrency } from '../lib/async-pool';

const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 20;

function sourceUrlToR2Key(sourceUrl: string): string | null {
  if (sourceUrl.startsWith('/api/upload/image/')) {
    const filename = sourceUrl.slice('/api/upload/image/'.length);
    return filename ? `images/${filename}` : null;
  }
  if (sourceUrl.startsWith('/api/upload/audio/')) {
    const filename = sourceUrl.slice('/api/upload/audio/'.length);
    return filename ? `voice/${filename}` : null;
  }
  return null;
}

async function getR2ObjectSize(key: string): Promise<number | null> {
  try {
    const head = await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Starting backfill${DRY_RUN ? ' (DRY RUN)' : ''}…`);

  const assets = await db.$queryRaw<{ id: string; sourceUrl: string; provider: string }[]>`
    SELECT id, "sourceUrl", provider
    FROM video_assets
    WHERE provider IN ('R2_IMAGE', 'R2_AUDIO')
      AND size_bytes = 0
  `;

  console.log(`Found ${assets.length} assets with sizeBytes = 0`);
  if (assets.length === 0) {
    await disconnectDb();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  await runWithConcurrency(assets, CONCURRENCY, async (asset) => {
    const key = sourceUrlToR2Key(asset.sourceUrl);
    if (!key) {
      console.warn(`  [SKIP] ${asset.id} — cannot derive R2 key from: ${asset.sourceUrl}`);
      skipped++;
      return;
    }

    const size = await getR2ObjectSize(key);
    if (size === null) {
      console.warn(`  [MISS] ${asset.id} — object not found in R2: ${key}`);
      missing++;
      return;
    }

    if (!DRY_RUN) {
      await db.$executeRaw`
        UPDATE video_assets SET size_bytes = ${BigInt(size)} WHERE id = ${asset.id}
      `;
    }

    console.log(`  [OK]   ${asset.id} — ${key}: ${size} bytes`);
    updated++;
  });

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Missing in R2: ${missing}`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
