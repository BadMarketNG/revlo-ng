import { NextResponse } from 'next/server';
import { isEmail, signToken, verifyToken } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { findActiveBlock, normaliseEmail, requestIp, silentEmailSuccess } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';
import { badgeLinkRemaining, isPublishTokenUsed, publishTokenHash } from '@/lib/publishToken';
import { publicOrigin } from '@/lib/publicOrigin';
import { beginMagicLinkAudit, finishMagicLinkDelivery, hasActiveMagicLink, markMagicLinkOpened } from '@/lib/magicLinkAudit';
import { getPublisherStatus, publishLinkAllowance } from '@/lib/revloFeatures';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// POST /api/magic-link { email }  -> emails a short-lived publish link.
export async function POST(request) {
  const sourceIp = requestIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { email } = body || {};
  if (!isEmail(email))
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  const cleanEmail = normaliseEmail(email);
  if (await findActiveBlock({ email: cleanEmail, ip: sourceIp })) return silentEmailSuccess();
  const ipLimited = await requireRateLimit({ action: 'magic-link:ip:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (ipLimited) return ipLimited;

  // NOTE (2026-09-29): Silver, Bronze and Gold publishers get a badge link that
  // creates 50, 100 or 200 posts with no time limit. Everyone else continues
  // below on the original one-post, 30-minute path, unchanged.
  // NOTE: publishers without a badge also get a multi-post link (default 5 posts),
  // which still expires after 30 minutes. An allowance of 1 uses the original path.
  let allowance = 1;
  let hasBadge = false;
  try {
    const status = await getPublisherStatus(cleanEmail);
    hasBadge = Boolean(status.trustBadge);
    allowance = publishLinkAllowance(status.trustBadge, status.settings);
  } catch {
    allowance = 1;
  }
  if (allowance > 1) return sendBadgeLink(cleanEmail, allowance, hasBadge);

  try {
    if (await hasActiveMagicLink(cleanEmail)) return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  const emailLimited = await requireRateLimit({ action: 'magic-link:email:hour', key: cleanEmail, limit: 3, windowSeconds: 3600 });
  if (emailLimited) return emailLimited;

  let token;
  try {
    token = signToken({ email: cleanEmail, action: 'publish' }, 30 * 60 * 1000);
  } catch (error) {
    console.error('[magic-link]', error.message);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  const base = publicOrigin();
  const link = `${base}/?token=${encodeURIComponent(token)}`;

  try {
    const reserved = await beginMagicLinkAudit({
      token,
      email: cleanEmail,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    // Another simultaneous request may have reserved the active link first.
    // Keep the outward response identical and do not send a second email.
    if (!reserved) return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }

  const sent = await sendEmail({
    to: cleanEmail,
    subject: 'Your Revlo.ng publish link',
    html: wrapEmail(`
      <p style="margin:0 0 16px;">Here is your one-time publish link. It expires in <strong>30 minutes</strong>.</p>
      <a href="${link}"
         style="display:inline-block;background:#1B5E20;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:24px;">
        Continue Publishing
      </a>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you didn't request this, you can safely ignore this email — no account was created.
      </p>
    `),
  });
  await finishMagicLinkDelivery(token, sent);
  if (sent.ok === false) {
    return NextResponse.json({ error: 'Could not send the email. Try again shortly.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

// Badge link: replaces any earlier unused link for this email (so a lost or
// leaked link can be cancelled by requesting a new one), then emails a link that
// creates `allowance` posts and never expires with time.
const BADGE_LINK_LIFETIME_MS = 100 * 365 * 24 * 60 * 60 * 1000;

const NORMAL_LINK_LIFETIME_MS = 30 * 60 * 1000;

async function sendBadgeLink(cleanEmail, allowance, hasBadge = true) {
  const lifetimeMs = hasBadge ? BADGE_LINK_LIFETIME_MS : NORMAL_LINK_LIFETIME_MS;
  const emailLimited = await requireRateLimit({ action: 'magic-link:email:hour', key: cleanEmail, limit: 3, windowSeconds: 3600 });
  if (emailLimited) return emailLimited;
  let token;
  try {
    token = signToken({ email: cleanEmail, action: 'publish', uses: allowance }, lifetimeMs);
  } catch (error) {
    console.error('[magic-link:badge]', error.message);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  const now = new Date().toISOString();
  const { error: supersedeError } = await supabaseAdmin
    .from('revlo_magic_link_events')
    .update({ expires_at: now })
    .eq('email', cleanEmail)
    .is('redeemed_at', null)
    .gt('expires_at', now);
  const { error: insertError } = await supabaseAdmin.from('revlo_magic_link_events').insert({
    token_hash: publishTokenHash(token),
    email: cleanEmail,
    expires_at: new Date(Date.now() + lifetimeMs).toISOString(),
  });
  if (supersedeError || insertError) {
    console.error('[magic-link:badge:audit]', (supersedeError || insertError).code);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  const link = `${publicOrigin()}/?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail({
    to: cleanEmail,
    subject: 'Your Revlo.ng publish link',
    html: wrapEmail(`
      <p style="margin:0 0 16px;">${hasBadge
        ? `Thanks to your Revlo badge, this link publishes up to <strong>${allowance} posts</strong> and does not expire with time. Open it each time you want to post.`
        : `This link publishes up to <strong>${allowance} posts</strong> within <strong>30 minutes</strong>. Open it each time you want to post. Earn a Revlo badge for links with more posts and no time limit.`}</p>
      <a href="${link}"
         style="display:inline-block;background:#1B5E20;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:24px;">
        Continue Publishing
      </a>
      <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Keep this email private: anyone with the link can publish as you. Requesting a new link cancels this one.</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">If you didn't request this, you can safely ignore this email.</p>
    `),
  });
  await finishMagicLinkDelivery(token, sent);
  if (sent.ok === false) {
    return NextResponse.json({ error: 'Could not send the email. Try again shortly.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

// GET /api/magic-link?token=...  -> verify a token (used by the create form).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const payload = verifyToken(token);
  if (!payload || payload.action !== 'publish') {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  // NOTE (2026-09-29): badge links are checked by posts remaining, not single use.
  const limit = Number.isInteger(payload.uses) && payload.uses > 1 ? payload.uses : 1;
  let used;
  let remaining = null;
  try {
    if (limit > 1) {
      remaining = await badgeLinkRemaining(token, limit);
      used = remaining === null || remaining < 1;
    } else {
      used = await isPublishTokenUsed(token);
    }
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  if (used) return NextResponse.json({ valid: false, used: true }, { status: 410 });
  await markMagicLinkOpened(token);
  if (await findActiveBlock({ email: payload.email, ip: requestIp(request) })) return NextResponse.json({ valid: false }, { status: 400 });
  return NextResponse.json({ valid: true, email: payload.email, publisher: await getPublisherStatus(payload.email), publishLink: { limit, remaining: limit > 1 ? remaining : 1 } });
}
