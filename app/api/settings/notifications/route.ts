import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import nodemailer from 'nodemailer';
import { testEmailHtml } from '@/lib/notifications';

// GET /api/settings/notifications — Fetch current notification preferences
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const settings = await db.notificationSetting.findUnique({
            where: { userId: session.user.id },
        });

        // Return defaults if no settings exist yet
        return NextResponse.json(
            settings ?? {
                telegramBotToken: null,
                telegramChatId: null,
                telegramEnabled: false,
                emailEnabled: false,
                onNewVideo: true,
                onNewComment: true,
                onNewReply: true,
                timezone: 'UTC',
            }
        );
    } catch (error) {
        console.error('Error fetching notification settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

// PUT /api/settings/notifications — Update notification preferences
export async function PUT(request: NextRequest) {
    try {
        const limited = await rateLimit(request, 'mutate');
        if (limited) return limited;

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            telegramBotToken,
            telegramChatId,
            telegramEnabled,
            emailEnabled,
            onNewVideo,
            onNewComment,
            onNewReply,
            timezone,
        } = body;

        // Validate: if enabling Telegram, both token and chatId are required
        if (telegramEnabled && (!telegramBotToken || !telegramChatId)) {
            return NextResponse.json(
                { error: 'Telegram Bot Token and Chat ID are required to enable Telegram notifications' },
                { status: 400 }
            );
        }

        const settings = await db.notificationSetting.upsert({
            where: { userId: session.user.id },
            create: {
                userId: session.user.id,
                telegramBotToken: telegramBotToken || null,
                telegramChatId: telegramChatId || null,
                telegramEnabled: !!telegramEnabled,
                emailEnabled: !!emailEnabled,
                onNewVideo: onNewVideo ?? true,
                onNewComment: onNewComment ?? true,
                onNewReply: onNewReply ?? true,
                timezone: timezone || 'UTC',
            },
            update: {
                telegramBotToken: telegramBotToken || null,
                telegramChatId: telegramChatId || null,
                telegramEnabled: !!telegramEnabled,
                emailEnabled: !!emailEnabled,
                onNewVideo: onNewVideo ?? true,
                onNewComment: onNewComment ?? true,
                onNewReply: onNewReply ?? true,
                timezone: timezone || 'UTC',
            },
        });

        return NextResponse.json(settings);
    } catch (error) {
        console.error('Error updating notification settings:', error);
        return NextResponse.json(
            { error: 'Failed to update settings' },
            { status: 500 }
        );
    }
}

// POST /api/settings/notifications — Test a notification channel
export async function POST(request: NextRequest) {
    try {
        const limited = await rateLimit(request, 'mutate');
        if (limited) return limited;

        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { channel, telegramBotToken, telegramChatId } = body;

        if (channel === 'telegram') {
            if (!telegramBotToken || !telegramChatId) {
                return NextResponse.json(
                    { error: 'Bot Token and Chat ID are required' },
                    { status: 400 }
                );
            }

            const settingsUrl = `${process.env.NEXTAUTH_URL || ''}/settings`;
            const telegramPayload: Record<string, unknown> = {
                chat_id: telegramChatId,
                text: '✅ OpenFrame notifications connected successfully!\n\nYou will receive notifications here when activity happens on your projects.',
                link_preview_options: { is_disabled: true },
            };
            // Telegram inline keyboard buttons require HTTPS URLs
            if (settingsUrl.startsWith('https://')) {
                telegramPayload.reply_markup = {
                    inline_keyboard: [[{ text: 'Open Settings', url: settingsUrl }]],
                };
            }
            const res = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(telegramPayload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                const desc = (data as { description?: string }).description || 'Unknown error';
                return NextResponse.json(
                    { error: `Telegram test failed: ${desc}` },
                    { status: 400 }
                );
            }

            return NextResponse.json({ success: true, message: 'Test message sent to Telegram' });
        }

        if (channel === 'email') {
            const user = await db.user.findUnique({
                where: { id: session.user.id },
                select: { email: true },
            });

            if (!user?.email) {
                return NextResponse.json(
                    { error: 'No email address on your account' },
                    { status: 400 }
                );
            }

            const smtpHost = process.env.SMTP_HOST;
            const smtpPort = Number(process.env.SMTP_PORT || '587');
            const smtpUser = process.env.SMTP_USER;
            const smtpPass = process.env.SMTP_PASSWORD;

            if (!smtpHost || !smtpUser || !smtpPass) {
                return NextResponse.json(
                    { error: 'Email service not configured (SMTP settings missing)' },
                    { status: 500 }
                );
            }

            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: { user: smtpUser, pass: smtpPass },
            });

            const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'OpenFrame <notifications@openframe.app>';

            try {
                await transporter.sendMail({
                    from: fromAddress,
                    to: user.email,
                    subject: '[OpenFrame] Test notification',
                    html: testEmailHtml(),
                });
            } catch (emailErr) {
                console.error('SMTP test email failed:', emailErr);
                return NextResponse.json(
                    { error: 'Failed to send test email — check SMTP settings' },
                    { status: 500 }
                );
            }

            return NextResponse.json({ success: true, message: `Test email sent to ${user.email}` });
        }

        return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
    } catch (error) {
        console.error('Error testing notification:', error);
        return NextResponse.json(
            { error: 'Failed to test notification' },
            { status: 500 }
        );
    }
}
