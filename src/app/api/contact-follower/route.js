import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { findActiveBlock, normaliseEmail, requestIp, silentEmailSuccess } from '@/lib/revloBlocklist';
import { consumePendingPublicAction, createPendingPublicAction, discardPendingPublicAction, requireRateLimit } from '@/lib/security';
import { publicOrigin } from '@/lib/publicOrigin';
import { requireHuman } from '@/lib/turnstile';
import { sameInbox } from '@/lib/emailIdentity';
import { cleanAlias } from '@/lib/community';
import { getPublisherStatus } from '@/lib/revloFeatures';
import { followerContactLimit, requireNotSuspended } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

// Contacting followers (2026-10-01). Only the poster can contact the people
// following them, and only followers who gave their alias when following.
// The poster clicks a follower's alias, enters the email they published with,
// confirms it through an emailed link (the same process as contacting a
// poster), and the message is then sent to the follower with the poster's
// email address so the follower can reply. Per-post limits: no badge = admin
// setting (default 1 follower), Bronze = half, Silver/Gold/paid = all.

const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function contactableFollowers(posterEmail) {
  const { data } = await supabaseAdmin.from('follows').select('follower_email,follower_alias')
    .eq('poster_email', posterEmail).not('follower_alias', 'is', null).limit(10000);
  return data || [];
}

async function limitsFor(post, posterEmail, contactable) {
  const status = await getPublisherStatus(posterEmail);
  const { data: promo } = await supabaseAdmin.from('revlo_promotions').select('post_uid').eq('post_uid', post.uid).limit(1);
  const paid = Boolean(status.premiumActive || post.premium_badge || promo?.length);
  const limit = followerContactLimit({ badge: status.trustBadge, paid }, contactable.length, status.settings ? { ...status.settings } : {});
  const { data: done } = await supabaseAdmin.from('revlo_follower_contacts').select('follower_email').eq('post_uid', post.uid);
  return { limit, contacted: new Set((done || []).map((row) => row.follower_email)) };
}

export async function POST(request) {
  const notHuman = requireHuman(request);
  if (notHuman) return notHuman;
  const sourceIp = requestIp(request);
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  const { uid, from_email, message } = body;
  const alias = cleanAlias(body.follower_alias);
  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
  if (alias.error || !alias.value) return NextResponse.json({ error: 'Choose a follower to contact.' }, { status: 400 });
  if (!isEmail(from_email)) return NextResponse.json({ error: 'Enter the email address you used to create this post.' }, { status: 400 });
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (cleanMessage.length < 2 || cleanMessage.length > 2000) return NextResponse.json({ error: 'Write a message of up to 2,000 characters.' }, { status: 400 });
  const sender = normaliseEmail(from_email);

  const ipLimited = await requireRateLimit({ action: 'contact-follower:ip:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (ipLimited) return ipLimited;
  const emailLimited = await requireRateLimit({ action: 'contact-follower:email:hour', key: sender, limit: 10, windowSeconds: 3600 });
  if (emailLimited) return emailLimited;

  const { data: post } = await supabaseAdmin.from('posts').select('uid,title,poster_email,premium_badge,expires_at,deleted_at').eq('uid', uid).maybeSingle();
  if (!post || post.deleted_at || new Date(post.expires_at) < new Date()) return NextResponse.json({ error: 'post not available' }, { status: 404 });
  // Only the post's owner may contact its followers. Anyone else gets the same
  // neutral reply, so the form never confirms who owns a post.
  if (!sameInbox(sender, post.poster_email)) return NextResponse.json({ error: 'Only the person who created this post can contact its followers. Use the email address you published it with.' }, { status: 403 });
  const suspended = await requireNotSuspended(post.poster_email, 'contact your followers');
  if (suspended) return suspended;
  if (await findActiveBlock({ email: post.poster_email, ip: sourceIp })) return silentEmailSuccess({ pending: true });

  const contactable = await contactableFollowers(post.poster_email);
  const target = contactable.find((f) => f.follower_alias.toLowerCase() === alias.value.toLowerCase());
  if (!target) return NextResponse.json({ error: 'That follower cannot be contacted.' }, { status: 404 });
  const { limit, contacted } = await limitsFor(post, post.poster_email, contactable);
  if (!contacted.has(target.follower_email) && contacted.size >= limit) {
    return NextResponse.json({ error: `You have contacted ${contacted.size} of the ${limit} ${limit === 1 ? 'follower' : 'followers'} allowed from this post. Earn a badge to contact more.` }, { status: 429 });
  }

  let pending;
  try {
    pending = await createPendingPublicAction({
      action: 'contact_follower', postUid: uid, email: sender, sourceIp,
      message: JSON.stringify({ follower_email: target.follower_email, alias: target.follower_alias, text: cleanMessage }),
    });
  } catch {
    return NextResponse.json({ error: 'contact verification is temporarily unavailable' }, { status: 503 });
  }
  const confirmUrl = `${publicOrigin()}/api/contact-follower?token=${encodeURIComponent(pending.token)}`;
  const result = await sendEmail({
    to: sender,
    subject: 'Confirm your message to a Revlo.ng follower',
    html: wrapEmail(`<p>Confirm that you want to send your message to <strong>${escapeHtml(target.follower_alias)}</strong>, who follows you on Revlo.ng.</p><p><a href="${confirmUrl}">Confirm and send message</a></p><p>This one-time link expires in 30 minutes. If you did not request it, ignore this email.</p>`),
  });
  if (result?.ok === false) {
    await discardPendingPublicAction(pending.id);
    return NextResponse.json({ error: 'failed to send confirmation' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, pending: true, remaining: Math.max(0, limit - contacted.size - (contacted.has(target.follower_email) ? 0 : 1)) });
}

export async function GET(request) {
  const pending = await consumePendingPublicAction('contact_follower', request.nextUrl.searchParams.get('token'));
  if (!pending) return htmlResponse('This confirmation link is invalid or has expired.', 400);
  let data;
  try { data = JSON.parse(pending.message || '{}'); } catch { data = {}; }
  const { data: post } = await supabaseAdmin.from('posts').select('uid,title,poster_email,premium_badge,expires_at,deleted_at').eq('uid', pending.post_uid).maybeSingle();
  if (!post || post.deleted_at || !data.follower_email || !sameInbox(pending.email, post.poster_email)) return htmlResponse('This message can no longer be sent.', 410);
  if (await requireNotSuspended(post.poster_email)) return htmlResponse('Your email is suspended on Revlo, so the message was not sent.', 403);
  // The follower must still follow, with the same alias, and the limit must still allow it.
  const contactable = await contactableFollowers(post.poster_email);
  const target = contactable.find((f) => f.follower_email === data.follower_email);
  if (!target) return htmlResponse('This person no longer follows you, so the message was not sent.', 410);
  const { limit, contacted } = await limitsFor(post, post.poster_email, contactable);
  if (!contacted.has(target.follower_email) && contacted.size >= limit) return htmlResponse('You have reached the number of followers you can contact from this post.', 429);
  if (await findActiveBlock({ email: target.follower_email })) return htmlResponse('Your email was verified and the message has been sent.', 200);

  const result = await sendEmail({
    to: target.follower_email,
    subject: `Revlo.ng: a message from a publisher you follow`,
    html: wrapEmail(`<p>The publisher of <strong>${escapeHtml(post.title)}</strong> (${post.uid}), whom you follow on Revlo.ng, sent you a verified message.</p><p><strong>From:</strong> ${escapeHtml(pending.email)}</p><blockquote>${escapeHtml(data.text)}</blockquote><p>Reply directly to ${escapeHtml(pending.email)} to respond. To stop hearing from this publisher, unfollow them from any of their alert emails.</p>`),
    headers: { 'Reply-To': pending.email },
  });
  if (result?.ok === false) return htmlResponse('The message could not be delivered.', 502);
  await supabaseAdmin.from('revlo_follower_contacts').upsert({ post_uid: post.uid, poster_email: normaliseEmail(post.poster_email), follower_email: target.follower_email }, { onConflict: 'post_uid,follower_email', ignoreDuplicates: true });
  return htmlResponse(`Your email was verified and your message has been sent to ${escapeHtml(target.follower_alias)}.`, 200);
}

function htmlResponse(message, status) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Revlo.ng</h2><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  );
}
