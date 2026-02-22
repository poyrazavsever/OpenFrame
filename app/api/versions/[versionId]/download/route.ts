import { db } from '@/lib/db';
import { auth, checkProjectAccess } from '@/lib/auth';
import { apiErrors, successResponse, withCacheControl } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

type RouteParams = { params: Promise<{ versionId: string }> };

const BUNNY_DOWNLOAD_FALLBACK_HEIGHTS = [2160, 1440, 1080, 720, 480, 360, 240];
const BUNNY_ALLOWED_QUALITIES = new Set(BUNNY_DOWNLOAD_FALLBACK_HEIGHTS);
const DEFAULT_BUNNY_CDN_HOSTNAME = 'vz-965f4f4a-fc1.b-cdn.net';
const DOWNLOAD_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 };

function sanitizeFileName(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized.length > 0 ? sanitized : 'video';
}

function toAsciiFileName(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 0 ? normalized : 'video';
}

function buildContentDisposition(fileNameWithExt: string): string {
  const asciiFallback = toAsciiFileName(fileNameWithExt).replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileNameWithExt);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function resolveBunnyCdnHostname(): string {
  const raw = process.env.BUNNY_CDN_URL || process.env.NEXT_PUBLIC_BUNNY_CDN_URL;
  if (!raw) return DEFAULT_BUNNY_CDN_HOSTNAME;

  try {
    const url = new URL(raw);
    return url.hostname || DEFAULT_BUNNY_CDN_HOSTNAME;
  } catch {
    return raw.replace(/^https?:\/\//, '').replace(/\/+$/, '') || DEFAULT_BUNNY_CDN_HOSTNAME;
  }
}

async function resolveHighestBunnyMp4Url(videoId: string): Promise<string> {
  const hostname = resolveBunnyCdnHostname();
  const playlistUrl = `https://${hostname}/${videoId}/playlist.m3u8`;

  let playlistHeights: number[] = [];
  try {
    const playlistRes = await fetch(playlistUrl, { cache: 'no-store' });
    if (playlistRes.ok) {
      const playlist = await playlistRes.text();
      const matches = [...playlist.matchAll(/RESOLUTION=\d+x(\d+)/g)];
      playlistHeights = matches
        .map((match) => Number(match[1]))
        .filter((height) => Number.isFinite(height) && height > 0)
        .sort((a, b) => b - a);
    }
  } catch {
    // Continue with static fallback list below.
  }

  const candidateHeights = [...new Set([...playlistHeights, ...BUNNY_DOWNLOAD_FALLBACK_HEIGHTS])];

  for (const height of candidateHeights) {
    const candidateUrl = `https://${hostname}/${videoId}/play_${height}p.mp4`;
    try {
      const headRes = await fetch(candidateUrl, { method: 'HEAD', cache: 'no-store' });
      if (headRes.ok) return candidateUrl;

      if (headRes.status === 405) {
        const rangeRes = await fetch(candidateUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          cache: 'no-store',
        });
        if (rangeRes.ok || rangeRes.status === 206) return candidateUrl;
      }
    } catch {
      // Try next candidate.
    }
  }

  // Last-resort fallback
  const fallbackHeight = candidateHeights[0] ?? 1080;
  return `https://${hostname}/${videoId}/play_${fallbackHeight}p.mp4`;
}

function extractHeightFromBunnyMp4Url(url: string): number | null {
  const match = url.match(/\/play_(\d+)p\.mp4$/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// GET /api/versions/[versionId]/download
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const limited = await rateLimit(request, 'video-download', DOWNLOAD_RATE_LIMIT);
    if (limited) return limited;

    const session = await auth();
    const { versionId } = await params;
    const { searchParams } = new URL(request.url);
    const isPrepareOnly = searchParams.get('prepare') === '1';
    const requestedQuality = Number(searchParams.get('quality'));
    const rawQuality = searchParams.get('quality');

    const version = await db.videoVersion.findUnique({
      where: { id: versionId },
      include: {
        video: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!version) {
      return apiErrors.notFound('Version');
    }

    const access = await checkProjectAccess(version.video.project, session?.user?.id);
    if (!access.hasAccess) {
      return apiErrors.forbidden('Access denied');
    }

    if (version.providerId !== 'bunny') {
      return apiErrors.badRequest('Download is currently supported for Bunny versions only');
    }

    if (
      rawQuality !== null &&
      (!Number.isFinite(requestedQuality) || !BUNNY_ALLOWED_QUALITIES.has(requestedQuality))
    ) {
      return apiErrors.badRequest('Invalid quality. Allowed values: 2160, 1440, 1080, 720, 480, 360, 240');
    }

    const sourceUrl = Number.isFinite(requestedQuality) && requestedQuality > 0
      ? `https://${resolveBunnyCdnHostname()}/${version.videoId}/play_${requestedQuality}p.mp4`
      : await resolveHighestBunnyMp4Url(version.videoId);
    const resolvedQuality = extractHeightFromBunnyMp4Url(sourceUrl);

    if (isPrepareOnly) {
      const response = successResponse({
        quality: resolvedQuality,
      });
      return withCacheControl(response, 'private, no-store');
    }

    const upstream = await fetch(sourceUrl, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      return apiErrors.notFound('Download file');
    }

    const versionLabel = version.versionLabel?.trim() || `v${version.versionNumber}`;
    const filename = sanitizeFileName(`${version.video.title} ${versionLabel}`) + '.mp4';
    const contentDisposition = buildContentDisposition(filename);

    const response = new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'private, no-store',
      },
    });

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) response.headers.set('Content-Length', contentLength);

    return withCacheControl(response, 'private, no-store');
  } catch (error) {
    console.error('Error downloading version:', error);
    return apiErrors.internalError('Failed to download video');
  }
}
