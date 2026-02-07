import { handlers } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export const { GET } = handlers;

// Wrap NextAuth POST with login rate limiting
export async function POST(request: Request) {
    const limited = await rateLimit(request, 'login');
    if (limited) return limited;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return handlers.POST(request as any);
}
