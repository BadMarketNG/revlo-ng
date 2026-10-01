import { NextResponse } from 'next/server';
import { requireHuman } from '@/lib/turnstile';
import { cleanReason } from '@/lib/community';
import { attachDeviceCookie, ensureDeviceId, recordSignal } from '@/lib/activitySignals';
import { checkPosterForCaution } from '@/lib/collusion';
import { canonicalInbox, sameInbox } from '@/lib/emailIdentity';
import { cleanAlias, currentAlias } from '@/lib/community';
import { requireNotSuspended } from '@/lib/moderation';
import { refreshPosterFollowerCounts } from '@/lib/followerCounts';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { findActiveBlock, normaliseEmail, requestIp, silentEmailSuccess } from '@/lib/revloBlocklist';
import {
  consumePendingPublicAction,
  createPendingPublicAction,
  discardPendingPublicAction,
  requireRateLimit,
} from '@/lib/security';
import { publicOrigin } from '@/lib/publicOrigin';

export const dynamic = 'force-dynamic';

// POST /api/follow { uid, follower_email }
// Follows the poster behind a post (keyed on hidden poster_email).
export async function POST(request) {
  // NOTE (2026-09-30): Cloudflare Turnstile — requires the browser's security check (see src/lib/turnstile.js).
  const notHuman = requireHuman(request);
  if (notHuman) return notHuman;
  const sourceIp = requestIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { uid, follower_email } = body || {};
  // NOTE (2026-09-30): optional public note on why they follow, shown under the poster's posts.
  const reason = cleanReason(body?.reason);
  if (reason.error) return NextResponse.json({ error: reason.error }, { status: 400 });
  // NOTE (2026-10-01): optional follower alias (the alias they publish under).
  // It is checked against their account only after they confirm by email, so
  // this form never reveals which email owns an alias. Only followers with an
  // alias can be contacted by the poster.
  const followerAlias = cleanAlias(body?.follower_alias);
  if (followerAlias.error) return NextResponse.json({ error: followerAlias.error }, { status: 400 });

  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
  if (!isEmail(follower_email))
    return NextResponse.json({ error: 'valid follower_email required' }, { status: 400 });
  const follower = normaliseEmail(follower_email);
  const suspended = await requireNotSuspended(follower, 'follow publishers');
  if (suspended) return suspended;
  if (await findActiveBlock({ email: follower, ip: sourceIp })) {
    return silentEmailSuccess({ pending: true, followers: 0 });
  }
  const ipLimited = await requireRateLimit({ action: 'follow:ip:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (ipLimited) return ipLimited;
  const emailLimited = await requireRateLimit({ action: 'follow:email:day', key: follower, limit: 5, windowSeconds: 86400 });
  if (emailLimited) return emailLimited;

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('uid,poster_email,followable,followers,expires_at')
    .eq('uid', uid)
    .maybeSingle();

  if (!post || new Date(post.expires_at) < new Date()) {
    return NextResponse.json({ error: 'post not available' }, { status: 404 });
  }
  if (!post.followable) {
    return NextResponse.json({ error: 'following disabled for this poster' }, { status: 403 });
  }

  // ORIGINAL (commented out 2026-09-30): only the exact same address was refused.
  // if (follower === post.poster_email) {
  //   return NextResponse.json({ error: 'cannot follow yourself' }, { status: 400 });
  // }
  // NOTE: an address that reaches the poster's inbox (john+1@, j.o.h.n@gmail) is the poster too,
  // and one inbox may follow a poster only once, whatever spelling it uses.
  if (sameInbox(follower, post.poster_email)) {
    return NextResponse.json({ error: 'cannot follow yourself' }, { status: 400 });
  }
  if (await inboxAlreadyFollows(post.poster_email, follower)) {
    return NextResponse.json({ error: 'This inbox already follows this poster under another address.' }, { status: 409 });
  }

  const { count } = await supabaseAdmin
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('poster_email', post.poster_email);

  const base = publicOrigin();
  let pending;
  try {
    // ORIGINAL (commented out 2026-10-01): message: reason.value
    // NOTE: the message now carries the note and the alias as JSON.
    const followMessage = reason.value || followerAlias.value ? JSON.stringify({ reason: reason.value, alias: followerAlias.value }) : null;
    pending = await createPendingPublicAction({ action: 'follow', postUid: uid, email: follower, message: followMessage, sourceIp });
  } catch {
    return NextResponse.json({ error: 'follow verification is temporarily unavailable' }, { status: 503 });
  }
  const confirmUrl = `${base}/api/follow?token=${encodeURIComponent(pending.token)}`;
  const delivery = await sendEmail({
    to: follower,
    subject: 'Confirm your Revlo.ng follow request',
    html: `<p>Confirm that you want email updates when this poster publishes.</p>
           <p><a href="${confirmUrl}">Confirm follow</a></p>
           <p>This one-time link expires in 30 minutes. If you did not request it, ignore this email.</p>`,
  });
  if (delivery?.ok === false) {
    await discardPendingPublicAction(pending.id);
    return NextResponse.json({ error: 'failed to send confirmation' }, { status: 502 });
  }

  // NOTE (2026-09-30): record network and device for collusion detection.
  const deviceId = ensureDeviceId(request);
  await recordSignal(request, { kind: 'follow_request', actorEmail: follower, subjectEmail: post.poster_email, postUid: uid, deviceId });
  return attachDeviceCookie(NextResponse.json({ ok: true, pending: true, followers: count || 0 }), deviceId);
}

export async function GET(request) {
  const pending = await consumePendingPublicAction('follow', request.nextUrl.searchParams.get('token'));
  if (!pending) return htmlResponse('This confirmation link is invalid or has expired.', 400);

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('uid,poster_email,followable,expires_at')
    .eq('uid', pending.post_uid)
    .maybeSingle();
  if (!post || !post.followable || new Date(post.expires_at) < new Date() || sameInbox(post.poster_email, pending.email)
    || await inboxAlreadyFollows(post.poster_email, pending.email)) {
    return htmlResponse('This follow request is no longer available.', 410);
  }
  if (await findActiveBlock({ email: pending.email })) {
    return htmlResponse('Your follow request is confirmed.', 200);
  }
  if (await requireNotSuspended(pending.email)) return htmlResponse('This email is suspended on Revlo, so the follow was not added.', 403);

  // The message is JSON { reason, alias } (2026-10-01) or, from older links, the note alone.
  let followData = { reason: pending.message, alias: null };
  try { if (pending.message?.startsWith('{')) followData = JSON.parse(pending.message); } catch {}
  const registeredAlias = followData.alias ? await currentAlias(pending.email) : null;
  const aliasMatches = Boolean(registeredAlias) && registeredAlias.toLowerCase() === String(followData.alias).toLowerCase();
  // ORIGINAL (commented out 2026-10-01):
  // const { error } = await supabaseAdmin.from('follows').insert({
  //   poster_email: post.poster_email,
  //   follower_email: pending.email,
  //   reason: cleanReason(pending.message).value || null,
  // });
  const { error } = await supabaseAdmin.from('follows').insert({
    poster_email: post.poster_email,
    follower_email: pending.email,
    reason: cleanReason(followData.reason).value || null,
    follower_alias: aliasMatches ? registeredAlias : null,
  });
  if (error && error.code !== '23505') return htmlResponse('Could not confirm this follow request.', 500);

  // ORIGINAL (commented out 2026-09-29): only the followed post's count was updated.
  // const { count } = await supabaseAdmin.from('follows').select('*', { count: 'exact', head: true })
  //   .eq('poster_email', post.poster_email);
  // await supabaseAdmin.from('posts').update({ followers: count || 0 }).eq('uid', post.uid);
  // NOTE: the count is the poster's, so all of their live posts are updated.
  await refreshPosterFollowerCounts(post.poster_email);
  const deviceId = ensureDeviceId(request);
  await recordSignal(request, { kind: 'follow_confirm', actorEmail: pending.email, subjectEmail: post.poster_email, postUid: post.uid, deviceId });
  // NOTE (2026-09-30): caution the poster automatically at 10 fabricated followers.
  await checkPosterForCaution(post.poster_email);
  const aliasNote = followData.alias && !aliasMatches
    ? ` Your alias "${String(followData.alias).replace(/[<>&"]/g, '')}" was not added because it is not the alias you publish under, so the poster cannot contact you.`
    : '';
  return attachDeviceCookie(htmlResponse(`Your follow request is confirmed.${aliasNote}`, 200), deviceId);
}

// True when another spelling of this follower's inbox already follows the poster.
async function inboxAlreadyFollows(posterEmail, followerEmail) {
  const inbox = canonicalInbox(followerEmail);
  const { data } = await supabaseAdmin.from('follows').select('follower_email').eq('poster_email', posterEmail).limit(10000);
  return (data || []).some((row) => row.follower_email !== followerEmail && canonicalInbox(row.follower_email) === inbox);
}

function htmlResponse(message, status) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Revlo.ng</h2><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  );
}
