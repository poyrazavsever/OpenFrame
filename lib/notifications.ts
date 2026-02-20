import { db } from '@/lib/db';
import nodemailer from 'nodemailer';

// ============================================
// NOTIFICATION CHANNELS
// ============================================

/**
 * Send a message via Telegram Bot API with optional inline keyboard button.
 */
async function sendTelegram(
    botToken: string,
    chatId: string,
    text: string,
    buttonLabel?: string,
    buttonUrl?: string,
): Promise<boolean> {
    try {
        const payload: Record<string, unknown> = {
            chat_id: chatId,
            text,
            link_preview_options: { is_disabled: true },
        };

        // Add inline keyboard button for clickable URL (Telegram requires HTTPS)
        if (buttonLabel && buttonUrl && buttonUrl.startsWith('https://')) {
            payload.reply_markup = {
                inline_keyboard: [[{ text: buttonLabel, url: buttonUrl }]],
            };
        }

        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const body = await res.text();
            console.error('Telegram API error:', res.status, body);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Telegram send failed:', err);
        return false;
    }
}

/**
 * Create a nodemailer SMTP transporter from environment variables.
 * Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD
 */
function createSmtpTransport() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;

    if (!host || !user || !pass) return null;

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

/**
 * Send an email notification via SMTP.
 * Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD environment variables.
 * Falls back to logging if not configured.
 */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const transporter = createSmtpTransport();
    const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'OpenFrame <notifications@openframe.app>';

    if (!transporter) {
        console.warn('SMTP not configured — skipping email notification');
        return false;
    }

    try {
        await transporter.sendMail({ from: fromAddress, to, subject, html });
        return true;
    } catch (err) {
        console.error('Email send failed:', err);
        return false;
    }
}

// ============================================
// NOTIFICATION EVENT TYPES
// ============================================

export type NotificationEvent =
    | { type: 'new_video'; projectName: string; videoTitle: string; addedBy: string; url: string }
    | { type: 'new_version'; projectName: string; videoTitle: string; versionLabel: string; addedBy: string; url: string }
    | { type: 'new_comment'; projectName: string; videoTitle: string; commentAuthor: string; commentText: string; timestamp: string; url: string }
    | { type: 'new_reply'; projectName: string; videoTitle: string; replyAuthor: string; replyText: string; parentAuthor: string; timestamp: string; url: string };

/** Structured Telegram message with text body + button label/URL */
interface TelegramMessage {
    text: string;
    buttonLabel: string;
    buttonUrl: string;
}

/**
 * Format a notification event into a Telegram message with an inline keyboard button.
 * The URL is no longer in the text body — it's attached as a clickable button instead.
 */
function formatTelegramMessage(event: NotificationEvent, timezone: string): TelegramMessage {
    const now = formatNow(timezone);
    switch (event.type) {
        case 'new_video':
            return {
                text:
                    `🎬 New Video Added\n\n` +
                    `▸ Project: ${event.projectName}\n` +
                    `▸ Video: ${event.videoTitle}\n` +
                    `▸ Added by: ${event.addedBy}\n` +
                    `▸ ${now}`,
                buttonLabel: 'View Video',
                buttonUrl: event.url,
            };
        case 'new_version':
            return {
                text:
                    `🎬 New Version Added\n\n` +
                    `▸ Project: ${event.projectName}\n` +
                    `▸ Video: ${event.videoTitle}\n` +
                    `▸ Version: ${event.versionLabel}\n` +
                    `▸ Added by: ${event.addedBy}\n` +
                    `▸ ${now}`,
                buttonLabel: 'View Version',
                buttonUrl: event.url,
            };
        case 'new_comment':
            return {
                text:
                    `💬 New Comment\n\n` +
                    `▸ Project: ${event.projectName}\n` +
                    `▸ Video: ${event.videoTitle}\n` +
                    `▸ By: ${event.commentAuthor} at ${event.timestamp}\n` +
                    `▸ ${now}\n\n` +
                    `"${truncate(event.commentText, 200)}"`,
                buttonLabel: 'View Comment',
                buttonUrl: event.url,
            };
        case 'new_reply':
            return {
                text:
                    `↩️ New Reply\n\n` +
                    `▸ Project: ${event.projectName}\n` +
                    `▸ Video: ${event.videoTitle}\n` +
                    `▸ ${event.replyAuthor} replied to ${event.parentAuthor}\n` +
                    `▸ ${now}\n\n` +
                    `"${truncate(event.replyText, 200)}"`,
                buttonLabel: 'View Reply',
                buttonUrl: event.url,
            };
    }
}

// ============================================
// EMAIL TEMPLATE
// ============================================

const BASE_URL = () => process.env.NEXTAUTH_URL || '';

// Theme colors (hex equivalents of oklch dark theme)
const COLORS = {
    bg: '#111114',        // page background (very dark)
    card: '#1a1a20',      // card background
    cardInner: '#212128', // inner card / section bg
    border: '#2a2a32',    // subtle border
    accent: '#2ec8d8',    // primary/accent teal-cyan
    accentDark: '#1a3a40',// accent background for headings
    text: '#ebebeb',      // primary text
    textSecondary: '#9a9a9f', // muted text
    textDim: '#6a6a72',   // dimmer labels
} as const;

/**
 * Wrap email body content in a branded template matching OpenFrame's dark theme.
 * Square corners (radius:0), card-based layout, teal accent, unsubscribe footer.
 */
function emailTemplate(body: string): string {
    const settingsUrl = `${BASE_URL()}/settings`;
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background-color:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.bg};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr><td style="padding:0 0 24px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;vertical-align:middle;color:${COLORS.accent};font-size:20px;">&#9654;</td>
            <td style="vertical-align:middle;font-size:18px;font-weight:700;color:${COLORS.text};letter-spacing:-0.3px;">OpenFrame</td>
          </tr></table>
        </td></tr>

        <!-- Main Card -->
        <tr><td style="background-color:${COLORS.card};border:1px solid ${COLORS.border};padding:0;">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 0 0;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:${COLORS.textDim};">You received this because email notifications are enabled.</p>
          <a href="${escapeAttr(settingsUrl)}" style="font-size:11px;color:${COLORS.accent};text-decoration:underline;">Unsubscribe &middot; Manage notification settings</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Generates an info row for email detail tables */
function emailRow(label: string, value: string, isHighlight = false): string {
    const valStyle = isHighlight
        ? `color:${COLORS.text};font-weight:600;`
        : `color:${COLORS.textSecondary};`;
    return `<tr>
      <td style="padding:6px 16px 6px 0;color:${COLORS.textDim};font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;font-size:13px;${valStyle}">${value}</td>
    </tr>`;
}

/** Generates the accent-colored event type heading bar */
function emailHeading(icon: string, title: string): string {
    return `<td style="padding:16px 20px;border-bottom:1px solid ${COLORS.border};background-color:${COLORS.accentDark};">
      <span style="font-size:14px;font-weight:600;color:${COLORS.accent};">${icon} &nbsp;${title}</span>
    </td>`;
}

/** Generates a CTA button */
function emailButton(text: string, url: string): string {
    return `<a href="${escapeAttr(url)}" style="display:inline-block;padding:9px 22px;background-color:${COLORS.accent};color:#0f1114;font-size:13px;font-weight:600;text-decoration:none;letter-spacing:0.2px;">${text}</a>`;
}

/**
 * Format a notification event into an email subject + full branded HTML email.
 */
function formatEmail(event: NotificationEvent, timezone: string): { subject: string; html: string } {
    const now = formatNow(timezone);
    switch (event.type) {
        case 'new_video':
            return {
                subject: `[OpenFrame] New video in ${event.projectName}: ${event.videoTitle}`,
                html: emailTemplate(`
                    <tr>${emailHeading('&#9654;', 'New Video Added')}</tr>
                    <tr><td style="padding:20px;">
                      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
                        ${emailRow('Project', escapeHtml(event.projectName), true)}
                        ${emailRow('Video', escapeHtml(event.videoTitle), true)}
                        ${emailRow('Added by', escapeHtml(event.addedBy))}
                        ${emailRow('When', now)}
                      </table>
                      ${emailButton('View Video  &#8594;', event.url)}
                    </td></tr>
                `),
            };
        case 'new_version':
            return {
                subject: `[OpenFrame] New version of ${event.videoTitle} in ${event.projectName}`,
                html: emailTemplate(`
                    <tr>${emailHeading('&#9654;', 'New Version Added')}</tr>
                    <tr><td style="padding:20px;">
                      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;">
                        ${emailRow('Project', escapeHtml(event.projectName), true)}
                        ${emailRow('Video', escapeHtml(event.videoTitle), true)}
                        ${emailRow('Version', escapeHtml(event.versionLabel))}
                        ${emailRow('Added by', escapeHtml(event.addedBy))}
                        ${emailRow('When', now)}
                      </table>
                      ${emailButton('View Version  &#8594;', event.url)}
                    </td></tr>
                `),
            };
        case 'new_comment':
            return {
                subject: `[OpenFrame] New comment on ${event.videoTitle}`,
                html: emailTemplate(`
                    <tr>${emailHeading('&#9679;', 'New Comment')}</tr>
                    <tr><td style="padding:20px;">
                      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
                        ${emailRow('Project', escapeHtml(event.projectName), true)}
                        ${emailRow('Video', escapeHtml(event.videoTitle), true)}
                        ${emailRow('From', escapeHtml(event.commentAuthor))}
                        ${emailRow('At', event.timestamp)}
                        ${emailRow('When', now)}
                      </table>
                      <div style="border-left:2px solid ${COLORS.accent};padding:10px 14px;margin:0 0 20px;background-color:${COLORS.cardInner};color:${COLORS.textSecondary};font-size:13px;line-height:1.6;">
                        ${escapeHtml(truncate(event.commentText, 300))}
                      </div>
                      ${emailButton('View Comment  &#8594;', event.url)}
                    </td></tr>
                `),
            };
        case 'new_reply':
            return {
                subject: `[OpenFrame] ${event.replyAuthor} replied on ${event.videoTitle}`,
                html: emailTemplate(`
                    <tr>${emailHeading('&#8617;', 'New Reply')}</tr>
                    <tr><td style="padding:20px;">
                      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
                        ${emailRow('Project', escapeHtml(event.projectName), true)}
                        ${emailRow('Video', escapeHtml(event.videoTitle), true)}
                        ${emailRow('From', `<span style="color:${COLORS.text};font-weight:500;">${escapeHtml(event.replyAuthor)}</span> <span style="color:${COLORS.textDim};">&#8594;</span> ${escapeHtml(event.parentAuthor)}`)}
                        ${emailRow('When', now)}
                      </table>
                      <div style="border-left:2px solid ${COLORS.accent};padding:10px 14px;margin:0 0 20px;background-color:${COLORS.cardInner};color:${COLORS.textSecondary};font-size:13px;line-height:1.6;">
                        ${escapeHtml(truncate(event.replyText, 300))}
                      </div>
                      ${emailButton('View Reply  &#8594;', event.url)}
                    </td></tr>
                `),
            };
    }
}

/**
 * Generate branded HTML for test emails sent from settings page.
 */
export function testEmailHtml(): string {
    return emailTemplate(`
        <tr>${emailHeading('&#10003;', 'Test Notification')}</tr>
        <tr><td style="padding:20px;">
          <p style="margin:0 0 8px;font-size:14px;color:${COLORS.text};">Email notifications are working.</p>
          <p style="margin:0;font-size:13px;color:${COLORS.textSecondary};">You&rsquo;ll receive emails when there&rsquo;s activity on your projects.</p>
        </td></tr>
    `);
}

// ============================================
// MAIN DISPATCH
// ============================================

/**
 * Notify the project owner about an event.
 * Looks up the owner's notification settings and dispatches to enabled channels.
 * Best-effort — never throws, logs errors.
 */
export async function notifyProjectOwner(ownerId: string, event: NotificationEvent): Promise<void> {
    try {
        const settings = await db.notificationSetting.findUnique({
            where: { userId: ownerId },
            include: { user: { select: { email: true } } },
        });

        if (!settings) return; // No notification preferences configured

        const shouldNotify =
            (event.type === 'new_video' && settings.onNewVideo) ||
            (event.type === 'new_version' && settings.onNewVersion) ||
            (event.type === 'new_comment' && settings.onNewComment) ||
            (event.type === 'new_reply' && settings.onNewReply);

        if (!shouldNotify) return;

        const promises: Promise<boolean>[] = [];
        const tz = settings.timezone || 'UTC';
        // Telegram
        if (settings.telegramEnabled && settings.telegramBotToken && settings.telegramChatId) {
            const msg = formatTelegramMessage(event, tz);
            promises.push(sendTelegram(
                settings.telegramBotToken,
                settings.telegramChatId,
                msg.text,
                msg.buttonLabel,
                msg.buttonUrl,
            ));
        }

        // Email
        if (settings.emailEnabled && settings.user.email) {
            const { subject, html } = formatEmail(event, tz);
            promises.push(sendEmail(settings.user.email, subject, html));
        }

        await Promise.allSettled(promises);
    } catch (err) {
        console.error('Notification dispatch failed:', err);
    }
}

// ============================================
// HELPERS
// ============================================

/**
 * Format current date/time in the user's timezone.
 * Returns e.g. "Jan 15, 2025 at 3:45 PM"
 */
function formatNow(timezone: string): string {
    try {
        return new Date().toLocaleString('en-US', {
            timeZone: timezone,
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        // Invalid timezone — fall back to UTC
        return new Date().toLocaleString('en-US', {
            timeZone: 'UTC',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Escape a URL for use inside an HTML href="..." attribute */
function escapeAttr(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function truncate(str: string, maxLen: number): string {
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}
