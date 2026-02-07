import { db } from '@/lib/db';

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
}

// Default configs for different actions
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    register: { windowMs: 60 * 60 * 1000, maxRequests: 5 },      // 5 per hour
    login: { windowMs: 15 * 60 * 1000, maxRequests: 10 },        // 10 per 15 min
    api: { windowMs: 60 * 1000, maxRequests: 100 },              // 100 per minute
};

/**
 * Check and update rate limit for a given key and action
 * Uses PostgreSQL UNLOGGED table for performance
 */
export async function checkRateLimit(
    key: string,
    action: string,
    config?: RateLimitConfig
): Promise<RateLimitResult> {
    const { windowMs, maxRequests } = config || RATE_LIMIT_CONFIGS[action] || RATE_LIMIT_CONFIGS.api;
    const windowSeconds = Math.floor(windowMs / 1000);

    try {
        // Atomic upsert with window check
        // If window expired, reset count; otherwise increment
        const result = await db.$queryRaw<Array<{
            count: number;
            window_start: Date;
            is_new_window: boolean;
        }>>`
            INSERT INTO rate_limits (key, action, count, window_start)
            VALUES (${key}, ${action}, 1, NOW())
            ON CONFLICT (key, action) DO UPDATE SET
                count = CASE 
                    WHEN rate_limits.window_start < NOW() - (${windowSeconds} || ' seconds')::INTERVAL 
                    THEN 1 
                    ELSE rate_limits.count + 1 
                END,
                window_start = CASE 
                    WHEN rate_limits.window_start < NOW() - (${windowSeconds} || ' seconds')::INTERVAL 
                    THEN NOW() 
                    ELSE rate_limits.window_start 
                END
            RETURNING count, window_start, 
                (window_start = NOW()) as is_new_window
        `;

        const record = result[0];
        const resetAt = new Date(record.window_start.getTime() + windowMs);
        const remaining = Math.max(0, maxRequests - record.count);
        const allowed = record.count <= maxRequests;

        return { allowed, remaining, resetAt };
    } catch (error) {
        // If table doesn't exist, allow the request but log warning
        console.error('Rate limit check failed (table may not exist):', error);
        return {
            allowed: true,
            remaining: maxRequests,
            resetAt: new Date(Date.now() + windowMs),
        };
    }
}

/**
 * Get client IP from request headers
 * Handles common proxy headers
 */
export function getClientIp(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp;
    }

    // Fallback for local development
    return '127.0.0.1';
}

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult, maxRequests: number): HeadersInit {
    return {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
    };
}

/**
 * Cleanup old rate limit entries (call periodically)
 */
export async function cleanupRateLimits(): Promise<void> {
    try {
        await db.$executeRaw`SELECT cleanup_rate_limits()`;
    } catch (error) {
        console.error('Rate limit cleanup failed:', error);
    }
}
