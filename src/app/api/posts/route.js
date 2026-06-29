import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { makeUid, expiryFor, isValidDuration, isEmail } from '@/lib/util';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Columns safe to expose publicly (poster_email is HIDDEN).
const PUBLIC_COLS =
  'uid,title,description,location,header_url,thumb_url,media_type,video_url,gallery,contact_visibility,followable,duration,views,followers,created_at,expires_at';

// GET /api/posts?duration=now  -> list non-expired posts for a tab
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const duration = searchParams.get('duration') || 'now';
  if (!isValidDuration(duration)) {
    return NextResponse.json({ error: 'invalid duration' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .select(PUBLIC_COLS)
    .eq('duration', duration)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[posts:GET]', error);
    return NextResponse.json({ error: 'failed to load posts' }, { status: 500 });
  }
  return NextResponse.json({ posts: data });
}

// POST /api/posts -> create a post
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const {
    poster_email,
    title,
    description = '',
    location,
    header_url = null,
    thumb_url = null,
    media_type = 'images',
    video_url = null,
    gallery = [],
    contact_visibility = 'public',
    followable = true,
    duration,
  } = body || {};

  // Validation
  if (!isEmail(poster_email)) {
    return NextResponse.json({ error: 'valid poster_email required' }, { status: 400 });
  }
  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }
  if (!location || typeof location !== 'string') {
    return NextResponse.json({ error: 'location required' }, { status: 400 });
  }
  if (!isValidDuration(duration)) {
    return NextResponse.json({ error: 'valid duration required' }, { status: 400 });
  }
  if (!['public', 'private'].includes(contact_visibility)) {
    return NextResponse.json({ error: 'invalid contact_visibility' }, { status: 400 });
  }

  const expires_at = expiryFor(duration);

  // Generate a unique uid (retry on rare collision)
  let uid = makeUid();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabaseAdmin
      .from('posts')
      .select('uid')
      .eq('uid', uid)
      .maybeSingle();
    if (!existing) break;
    uid = makeUid();
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert({
      uid,
      poster_email: poster_email.trim().toLowerCase(),
      title: title.trim(),
      description: String(description).slice(0, 5000),
      location,
      header_url,
      thumb_url,
      media_type,
      video_url,
      gallery: Array.isArray(gallery) ? gallery : [],
      contact_visibility,
      followable: !!followable,
      duration,
      expires_at,
    })
    .select(PUBLIC_COLS)
    .single();

  if (error) {
    console.error('[posts:POST]', error);
    return NextResponse.json({ error: 'failed to create post' }, { status: 500 });
  }

  // Notify followers of this poster (fire and forget).
  notifyFollowers(poster_email.trim().toLowerCase(), data).catch((e) =>
    console.error('[notifyFollowers]', e)
  );

  return NextResponse.json({ post: data }, { status: 201 });
}

async function notifyFollowers(posterEmail, post) {
  const { data: followers } = await supabaseAdmin
    .from('follows')
    .select('follower_email')
    .eq('poster_email', posterEmail);
  if (!followers || followers.length === 0) return;

  const base = process.env.APP_URL || 'https://revlong.vercel.app';
  for (const f of followers) {
    await sendEmail({
      to: f.follower_email,
      subject: `New post on Revlo.ng: ${post.title}`,
      html: `<p>Someone you follow just published a new post.</p>
             <p><strong>${escapeHtml(post.title)}</strong><br/>${escapeHtml(post.location)}</p>
             <p><a href="${base}/#post-${post.uid}">View it on Revlo.ng</a></p>`,
    });
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
