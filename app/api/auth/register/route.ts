import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIp, rateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
    try {
        // Rate limiting by IP
        const clientIp = getClientIp(request);
        const rateLimitKey = `register:${clientIp}`;
        const rateLimit = await checkRateLimit(rateLimitKey, 'register');

        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Too many registration attempts. Please try again later.' },
                {
                    status: 429,
                    headers: rateLimitHeaders(rateLimit, RATE_LIMIT_CONFIGS.register.maxRequests),
                }
            );
        }

        const body = await request.json();
        const { name, email, password, inviteCode } = body;

        // Validate invite code using constant-time comparison to prevent timing attacks
        const validInviteCode = process.env.INVITE_CODE;
        if (!validInviteCode || !inviteCode) {
            return NextResponse.json(
                { error: 'Invalid invite code' },
                { status: 403 }
            );
        }

        // Constant-time comparison
        const { timingSafeEqual } = await import('crypto');
        const validBuffer = Buffer.from(validInviteCode);
        const providedBuffer = Buffer.from(String(inviteCode));

        // Ensure same length for comparison (prevents length-based timing leak)
        const isValidLength = validBuffer.length === providedBuffer.length;
        const compareBuffer = isValidLength ? providedBuffer : validBuffer;
        const isValidCode = isValidLength && timingSafeEqual(validBuffer, compareBuffer);

        if (!isValidCode) {
            return NextResponse.json(
                { error: 'Invalid invite code' },
                { status: 403 }
            );
        }

        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return NextResponse.json(
                { error: 'Name must be at least 2 characters' },
                { status: 400 }
            );
        }

        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        if (!password || typeof password !== 'string' || password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existingUser = await db.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'An account with this email already exists' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await db.user.create({
            data: {
                name: name.trim(),
                email: email.toLowerCase(),
                password: hashedPassword,
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
            },
        });

        const response = NextResponse.json(
            { message: 'Account created successfully', user },
            { status: 201 }
        );

        // Add rate limit headers to successful response
        const headers = rateLimitHeaders(rateLimit, RATE_LIMIT_CONFIGS.register.maxRequests);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Failed to create account' },
            { status: 500 }
        );
    }
}
