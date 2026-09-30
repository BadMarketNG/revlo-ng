import { NextResponse } from 'next/server';
import { attachDeviceCookie, ensureDeviceId, recordSignal } from '@/lib/activitySignals';
import { checkPosterForCaution } from '@/lib/collusion';
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
  const sourceIp = requestIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { uid, follower_email } = body || {};

  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
  if (!isEmail(follower_email))
    return NextResponse.json({ error: 'valid follower_email required' }, { status: 400 });
  const follower = normaliseEmail(follower_email);
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

  if (follower === post.poster_email) {
    return NextResponse.json({ error: 'cannot follow yourself' }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('poster_email', post.poster_email);

  const base = publicOrigin();
  let pending;
  try {
    pending = await createPendingPublicAction({ action: 'follow', postUid: uid, email: follower, sourceIp });
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
  if (!post || !post.followable || new Date(post.expires_at) < new Date() || post.poster_email === pending.email) {
    return htmlResponse('This follow request is no longer available.', 410);
  }
  if (await findActiveBlock({ email: pending.email })) {
    return htmlResponse('Your follow request is confirmed.', 200);
  }

  const { error } = await supabaseAdmin.from('follows').insert({
    poster_email: post.poster_email,
    follower_email: pending.email,
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
  return attachDeviceCookie(htmlResponse('Your follow request is confirmed.', 200), deviceId);
}

function htmlResponse(message, status) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Revlo.ng</h2><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  );
}
