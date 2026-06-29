import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// POST /api/contact { uid, from_email, message }
// Relays a message to the poster. The poster's email is never exposed to the sender.
export async function POST(request) {
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
  if (!message || String(message).trim().length < 2)
    return NextResponse.json({ error: 'message required' }, { status: 400 });

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

  const result = await sendEmail({
    to: post.poster_email,
    subject: `Revlo.ng: message about "${post.title}"`,
    html: `<p>You received a message about your Revlo.ng post <strong>${escapeHtml(
      post.title
    )}</strong> (${post.uid}).</p>
           <p><strong>From:</strong> ${escapeHtml(from_email)}</p>
           <p><strong>Message:</strong></p>
           <blockquote>${escapeHtml(message)}</blockquote>
           <p>Reply directly to ${escapeHtml(from_email)} to respond.</p>`,
    headers: { 'Reply-To': from_email },
  });

  if (result && result.ok === false) {
    return NextResponse.json({ error: 'failed to send' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
