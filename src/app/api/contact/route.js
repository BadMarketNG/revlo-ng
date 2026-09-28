import { NextResponse } from 'next/server';
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

// POST /api/contact { uid, from_email, message }
// Relays a message to the poster. The poster's email is never exposed to the sender.
export async function POST(request) {
  const sourceIp = requestIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { uid, from_email, message } = body || {};

  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
  if (!isEmail(from_email))
    return NextResponse.json({ error: 'valid from_email required' }, { status: 400 });
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (cleanMessage.length < 2 || cleanMessage.length > 2000)
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  const sender = normaliseEmail(from_email);
  if (await findActiveBlock({ email: sender, ip: sourceIp })) return silentEmailSuccess({ pending: true });
  const ipLimited = await requireRateLimit({ action: 'contact:ip:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (ipLimited) return ipLimited;
  const emailLimited = await requireRateLimit({ action: 'contact:email:hour', key: sender, limit: 3, windowSeconds: 3600 });
  if (emailLimited) return emailLimited;
  const postLimited = await requireRateLimit({ action: 'contact:post:hour', key: uid, limit: 10, windowSeconds: 3600 });
  if (postLimited) return postLimited;

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('uid,title,poster_email,contact_visibility,expires_at')
    .eq('uid', uid)
    .maybeSingle();

  if (!post || new Date(post.expires_at) < new Date()) {
    return NextResponse.json({ error: 'post not available' }, { status: 404 });
  }
  if (post.contact_visibility !== 'public') {
    return NextResponse.json({ error: 'contact disabled for this post' }, { status: 403 });
  }
  // Do not create a confirmation workflow that can ultimately notify a blocked
  // post owner. The sender sees the same response as a normal request.
  if (await findActiveBlock({ email: post.poster_email })) return silentEmailSuccess({ pending: true });

  let pending;
  try {
    pending = await createPendingPublicAction({
      action: 'contact', postUid: uid, email: sender, message: cleanMessage, sourceIp,
    });
  } catch {
    return NextResponse.json({ error: 'contact verification is temporarily unavailable' }, { status: 503 });
  }
  const base = publicOrigin();
  const confirmUrl = `${base}/api/contact?token=${encodeURIComponent(pending.token)}`;
  const result = await sendEmail({
    to: sender,
    subject: 'Confirm your Revlo.ng message',
    html: `<p>Confirm that you want to send a message about this Revlo.ng post.</p>
           <p><a href="${confirmUrl}">Confirm and send message</a></p>
           <p>This one-time link expires in 30 minutes. If you did not request it, ignore this email.</p>`,
  });
  if (result?.ok === false) {
    await discardPendingPublicAction(pending.id);
    return NextResponse.json({ error: 'failed to send confirmation' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, pending: true });
}

export async function GET(request) {
  const pending = await consumePendingPublicAction('contact', request.nextUrl.searchParams.get('token'));
  if (!pending) return htmlResponse('This confirmation link is invalid or has expired.', 400);

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('uid,title,poster_email,contact_visibility,expires_at')
    .eq('uid', pending.post_uid)
    .maybeSingle();
  if (!post || post.contact_visibility !== 'public' || new Date(post.expires_at) < new Date()) {
    return htmlResponse('This contact request is no longer available.', 410);
  }
  if (await findActiveBlock({ email: pending.email }) || await findActiveBlock({ email: post.poster_email })) {
    return htmlResponse('Your email was verified and the message has been sent.', 200);
  }
  const result = await sendEmail({
    to: post.poster_email,
    subject: `Revlo.ng: message about "${post.title}"`,
    html: `<p>You received a verified message about your Revlo.ng post <strong>${escapeHtml(post.title)}</strong> (${post.uid}).</p>
           <p><strong>From:</strong> ${escapeHtml(pending.email)}</p>
           <p><strong>Message:</strong></p><blockquote>${escapeHtml(pending.message)}</blockquote>
           <p>Reply directly to ${escapeHtml(pending.email)} to respond.</p>`,
    headers: { 'Reply-To': pending.email },
  });
  if (result?.ok === false) return htmlResponse('The message could not be delivered.', 502);
  return htmlResponse('Your email was verified and the message has been sent.', 200);
}

function htmlResponse(message, status) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Revlo.ng</h2><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  );
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
