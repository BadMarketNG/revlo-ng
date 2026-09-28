import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail, signToken, verifyToken } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { findActiveBlock, normaliseEmail, requestIp, silentEmailSuccess } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';
import { publicOrigin } from '@/lib/publicOrigin';

export const dynamic = 'force-dynamic';

// POST /api/delete { uid, email }
// If email matches the post's poster_email, emails a one-time delete link.
// (We respond 200 either way so we don't reveal whether the email matched.)
export async function POST(request) {
  const sourceIp = requestIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { uid, email } = body || {};

  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
  if (!isEmail(email))
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  const requester = normaliseEmail(email);
  if (await findActiveBlock({ email: requester, ip: sourceIp })) {
    return silentEmailSuccess({ message: 'If that email created the post, a delete link has been sent.' });
  }
  const ipLimited = await requireRateLimit({ action: 'delete-link:ip:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (ipLimited) return ipLimited;
  const emailLimited = await requireRateLimit({ action: 'delete-link:email:hour', key: requester, limit: 3, windowSeconds: 3600 });
  if (emailLimited) return emailLimited;

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('uid,poster_email,title')
    .eq('uid', uid)
    .maybeSingle();

  if (post && post.poster_email === requester) {
    let token;
    try {
      token = signToken({ uid, email: requester, action: 'delete' });
    } catch (error) {
      console.error('[delete]', error.message);
      return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
    }
    const base = publicOrigin();
    await sendEmail({
      to: requester,
      subject: `Confirm deletion of your Revlo.ng post`,
      html: `<p>Click below to permanently delete your post <strong>${escapeHtml(
        post.title
      )}</strong> (${post.uid}). This link expires in 30 minutes.</p>
             <p><a href="${base}/api/delete?token=${encodeURIComponent(
        token
      )}">Delete this post</a></p>
             <p>If you didn't request this, ignore this email.</p>`,
    });
  }

  // Always the same response.
  return NextResponse.json({
    ok: true,
    message: 'If that email created the post, a delete link has been sent.',
  });
}

// GET /api/delete?token=...  -> verifies token and deletes the post.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const payload = verifyToken(token);

  if (!payload || payload.action !== 'delete' || !payload.uid) {
    return htmlResponse('Invalid or expired link.', 400);
  }

  // Double-check ownership at delete time.
  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('poster_email')
    .eq('uid', payload.uid)
    .maybeSingle();

  if (!post) return htmlResponse('Post already gone.', 404);
  if (post.poster_email !== payload.email) {
    return htmlResponse('Invalid link.', 403);
  }

  const { error } = await supabaseAdmin.from('posts').delete().eq('uid', payload.uid);
  if (error) {
    console.error('[delete]', error);
    return htmlResponse('Could not delete. Try again.', 500);
  }
  return htmlResponse('Your post has been permanently deleted.', 200);
}

function htmlResponse(msg, status) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px">
       <h2>Revlo.ng</h2><p>${msg}</p>
     </body></html>`,
    { status, headers: { 'Content-Type': 'text/html' } }
  );
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
