import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { blockedResponse, findActiveBlock, normaliseEmail, requestIp } from '@/lib/revloBlocklist';

export const dynamic = 'force-dynamic';

// POST /api/follow { uid, follower_email }
// Follows the poster behind a post (keyed on hidden poster_email).
export async function POST(request) {
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
  if (await findActiveBlock({ email: normaliseEmail(follower_email), ip: requestIp(request) })) return blockedResponse();

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

  const follower = follower_email.trim().toLowerCase();
  if (follower === post.poster_email) {
    return NextResponse.json({ error: 'cannot follow yourself' }, { status: 400 });
  }

  // Insert (unique constraint prevents duplicates).
  const { error } = await supabaseAdmin
    .from('follows')
    .insert({ poster_email: post.poster_email, follower_email: follower });

  if (error && error.code !== '23505') {
    // 23505 = unique_violation (already following) -> treat as success
    console.error('[follow]', error);
    return NextResponse.json({ error: 'failed to follow' }, { status: 500 });
  }

  // Recount followers for this poster and store on the post for display.
  const { count } = await supabaseAdmin
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('poster_email', post.poster_email);

  await supabaseAdmin.from('posts').update({ followers: count || 0 }).eq('uid', uid);

  const base = process.env.APP_URL || 'https://revlong.vercel.app';
  await sendEmail({
    to: follower,
    subject: 'You are following a poster on Revlo.ng',
    html: `<p>You'll get an email whenever this poster publishes something new.</p>
           <p><a href="${base}/api/unfollow?email=${encodeURIComponent(
      follower
    )}&poster=${encodeURIComponent(post.poster_email)}">Unsubscribe</a></p>`,
  });

  return NextResponse.json({ ok: true, followers: count || 0 });
}
