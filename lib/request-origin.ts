import type { NextRequest } from 'next/server';

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getConfiguredOrigins(): string[] {
  const configured = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXTAUTH_URL];
  return configured
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => normalizeOrigin(/^https?:\/\//i.test(value) ? value : `https://${value}`))
    .filter((value): value is string => value !== null);
}

function getForwardedOrigin(request: NextRequest): string | null {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();

  if (!forwardedProto || !forwardedHost) return null;
  return normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
}

function getHostHeaderOrigin(request: NextRequest): string | null {
  const host = request.headers.get('host')?.split(',')[0]?.trim();
  if (!host) return null;

  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '');
  if (!protocol) return null;

  return normalizeOrigin(`${protocol}://${host}`);
}

export function getAllowedRequestOrigins(request: NextRequest): Set<string> {
  const origins = new Set<string>();
  origins.add(request.nextUrl.origin);

  const forwardedOrigin = getForwardedOrigin(request);
  if (forwardedOrigin) origins.add(forwardedOrigin);

  const hostHeaderOrigin = getHostHeaderOrigin(request);
  if (hostHeaderOrigin) origins.add(hostHeaderOrigin);

  for (const configuredOrigin of getConfiguredOrigins()) {
    origins.add(configuredOrigin);
  }

  return origins;
}

export function isTrustedSameOriginRequest(request: NextRequest): boolean {
  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) return false;

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedRequestOrigin) return false;

  return getAllowedRequestOrigins(request).has(normalizedRequestOrigin);
}
