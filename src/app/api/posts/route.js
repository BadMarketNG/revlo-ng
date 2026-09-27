import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { makeUid, expiryFor, isValidDuration, isValidCategory, isEmail, verifyToken } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { addAutomaticBlocks, blockedResponse, findActiveBlock, normaliseEmail, requestIp } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';
import { claimPublishToken, recordPublishTokenPost, releasePublishToken } from '@/lib/publishToken';
import { publicOrigin } from '@/lib/publicOrigin';
import { markMagicLinkRedeemed } from '@/lib/magicLinkAudit';

export const dynamic = 'force-dynamic';

// Columns safe to expose publicly (poster_email is HIDDEN).
const PUBLIC_COLS =
  'uid,title,description,location,category,header_url,thumb_url,media_type,video_url,gallery,contact_visibility,followable,duration,views,followers,created_at,expires_at';

// GET /api/posts?duration=now&category=jobs  -> list non-expired posts for a tab
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const duration = searchParams.get('duration') || 'now';
  const category = searchParams.get('category');
  if (!isValidDuration(duration)) {
    return NextResponse.json({ error: 'invalid duration' }, { status: 400 });
  }
  if (category && !isValidCategory(category)) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 });
  }

  let query = supabaseAdmin
    .from('posts')
    .select(PUBLIC_COLS)
    .eq('duration', duration)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;

  if (error) {
    console.error('[posts:GET]', error);
    return NextResponse.json({ error: 'failed to load posts' }, { status: 500 });
  }
  return NextResponse.json({ posts: data });
}

// POST /api/posts -> create a post
export async function POST(request) {
  const sourceIp = requestIp(request);
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
    category = 'general',
    header_url = null,
    thumb_url = null,
    gallery = [],
    contact_visibility = 'public',
    followable = true,
    duration,
    publish_token,
  } = body || {};

  // Validation
  if (!isEmail(poster_email)) {
    return NextResponse.json({ error: 'valid poster_email required' }, { status: 400 });
  }
  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }
  if (title.length > 200 || String(description).length > 5000 || location.length > 200) {
    return NextResponse.json({ error: 'post content is too long' }, { status: 413 });
  }
  if (!location || typeof location !== 'string') {
    return NextResponse.json({ error: 'location required' }, { status: 400 });
  }
  if (!isValidDuration(duration)) {
    return NextResponse.json({ error: 'valid duration required' }, { status: 400 });
  }
  if (!isValidCategory(category)) {
    return NextResponse.json({ error: 'invalid category' }, { status: 400 });
  }
  if (!['public', 'private'].includes(contact_visibility)) {
    return NextResponse.json({ error: 'invalid contact_visibility' }, { status: 400 });
  }
  if (body?.video_url || (body?.media_type && body.media_type !== 'images')) {
    return NextResponse.json({ error: 'video posts are not supported' }, { status: 415 });
  }

  const cleanEmail = normaliseEmail(poster_email);
  // Publishing requires the emailed magic link, issued for this exact address.
  const publishClaim = verifyToken(publish_token);
  if (!publishClaim || publishClaim.action !== 'publish' || publishClaim.email !== cleanEmail) {
    return NextResponse.json({ error: 'Open the publish link we emailed you to continue.' }, { status: 401 });
  }
  if (await findActiveBlock({ email: cleanEmail, ip: sourceIp })) return blockedResponse();
  const ipLimited = await requireRateLimit({ action: 'publish:ip:hour', key: sourceIp, limit: 10, windowSeconds: 3600 });
  if (ipLimited) return ipLimited;

  // Rate limit: max 5 posts per email per rolling hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateError } = await supabaseAdmin
    .from('posts')
    .select('uid', { count: 'exact', head: true })
    .eq('poster_email', poster_email.trim().toLowerCase())
    .gt('created_at', oneHourAgo);
  if (!rateError && recentCount >= 5) {
    await addAutomaticBlocks({
      email: cleanEmail,
      ip: sourceIp,
      reason: 'Exceeded the Revlo publishing limit of five posts per hour',
      source: 'publishing_limit',
      durationMs: 24 * 60 * 60 * 1000,
    });
    return NextResponse.json(
      { error: 'Too many posts from this email recently. Try again later.' },
      { status: 429 }
    );
  }

  // One emailed link creates one post.
  const claim = await claimPublishToken(publish_token, publishClaim.exp);
  if (claim.used) {
    return NextResponse.json({ error: 'This publish link has already been used. Request a new link for another post.' }, { status: 409 });
  }
  if (claim.error) {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
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
      poster_email: cleanEmail,
      source_ip: sourceIp || null,
      title: title.trim(),
      description: String(description).slice(0, 5000),
      location,
      category,
      header_url,
      thumb_url,
      media_type: 'images',
      video_url: null,
      gallery: Array.isArray(gallery) ? gallery : [],
      contact_visibility,
      followable: !!followable,
      duration,
      expires_at,
    })
    .select(PUBLIC_COLS)
    .single();

  if (error) {
    await releasePublishToken(publish_token).catch(() => {});
    console.error('[posts:POST]', error);
    return NextResponse.json({ error: 'failed to create post' }, { status: 500 });
  }

  await recordPublishTokenPost(publish_token, data.uid).catch(() => {});
  await markMagicLinkRedeemed(publish_token, data.uid).catch(() => {});

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

  const base = publicOrigin();
  for (const f of followers) {
    const unsubUrl = `${base}/api/unfollow?email=${encodeURIComponent(f.follower_email)}&poster=${encodeURIComponent(posterEmail)}`;
    await sendEmail({
      to: f.follower_email,
      subject: `New post on Revlo.ng: ${escapeHtml(post.title)}`,
      html: wrapEmail(`
        <p style="margin:0 0 16px;">Someone you follow just published something new.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:20px;">
          <p style="margin:0 0 6px;font-size:18px;font-weight:700;">${escapeHtml(post.title)}</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">${escapeHtml(post.location)}</p>
        </div>
        <a href="${base}/p/${post.uid}"
           style="display:inline-block;background:#1B5E20;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:24px;">
          View Post
        </a>
        <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #f3f4f6;padding-top:16px;">
          You're receiving this because you follow this poster on Revlo.ng.<br>
          <a href="${unsubUrl}" style="color:#1B5E20;">Unsubscribe</a>
        </p>
      `),
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
