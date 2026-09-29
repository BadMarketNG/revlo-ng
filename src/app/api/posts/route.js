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
import { earnedBadge, getFeatureSettings, getPublisherStatus, incrementPublisherPosts } from '@/lib/revloFeatures';
import {
  FEED_SESSION_COOKIE,
  createFeedSessionSeed,
  isFeedSessionSeed,
  saltedSessionOrder,
} from '@/lib/feedOrder.mjs';

export const dynamic = 'force-dynamic';

// Columns safe to expose publicly (poster_email is HIDDEN).
const PUBLIC_COLS =
  'uid,title,description,location,category,header_url,thumb_url,media_type,video_url,gallery,contact_visibility,followable,duration,views,followers,trust_badge,premium_badge,created_at,expires_at';

// A post's duration is how long it stays live from publication. Every post
// appears under "Right now" for its first 24 hours, then moves to the tab for
// its own duration (1, 2 or 3 months) until it expires.
const FIRST_DAY_MS = 24 * 60 * 60 * 1000;

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
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100);
  const firstDayStart = new Date(Date.now() - FIRST_DAY_MS).toISOString();
  query = duration === 'now'
    ? query.gt('created_at', firstDayStart)
    : query.eq('duration', duration).lte('created_at', firstDayStart);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;

  if (error) {
    console.error('[posts:GET]', error);
    return NextResponse.json({ error: 'failed to load posts' }, { status: 500 });
  }
  const existingSeed = request.cookies.get(FEED_SESSION_COOKIE)?.value;
  const feedSeed = isFeedSessionSeed(existingSeed) ? existingSeed : createFeedSessionSeed();
  const context = `${duration}:${category || 'all'}`;
  const response = NextResponse.json({ posts: saltedSessionOrder(data, feedSeed, context) });
  if (feedSeed !== existingSeed) {
    response.cookies.set(FEED_SESSION_COOKIE, feedSeed, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }
  return response;
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
    media_type = 'images',
    video_url = null,
    premium_payment_reference = null,
    promo_payment_reference = null,
  } = body || {};

  // Validation
  if (!isEmail(poster_email)) {
    return NextResponse.json({ error: 'valid poster_email required' }, { status: 400 });
  }
  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return NextResponse.json({ error: 'title required' }, { status: 400 });
  }
  if (title.length > 200 || String(description).length > 5000 || String(location || '').length > 200) {
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
  // Up to five gallery photos, each uploaded through /api/upload to Revlo's own storage.
  const storagePrefix = `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/${process.env.STORAGE_BUCKET || 'media'}/`;
  // Every post needs its own header image and icon, uploaded to Revlo storage
  // (publishers without photos pick a free sample in the post form).
  const fromStorage = (value) => typeof value === 'string' && value.startsWith(storagePrefix) && value.length <= 500;
  if (!fromStorage(header_url) || !fromStorage(thumb_url) || header_url === thumb_url) {
    return NextResponse.json({ error: 'Add a header image and an icon — upload your own or pick a free sample.' }, { status: 422 });
  }
  if (gallery != null && (!Array.isArray(gallery) || gallery.length > 5
      || gallery.some((item) => typeof item !== 'string' || !item.startsWith(storagePrefix) || item.length > 500))) {
    return NextResponse.json({ error: 'Add up to 5 photos uploaded through Revlo.' }, { status: 400 });
  }
  if (!['images', 'video'].includes(media_type) || (media_type === 'video' && !video_url)) {
    return NextResponse.json({ error: 'invalid media' }, { status: 415 });
  }

  const cleanEmail = normaliseEmail(poster_email);
  // Publishing requires the emailed magic link, issued for this exact address.
  const publishClaim = verifyToken(publish_token);
  if (!publishClaim || publishClaim.action !== 'publish' || publishClaim.email !== cleanEmail) {
    return NextResponse.json({ error: 'Open the publish link we emailed you to continue.' }, { status: 401 });
  }
  if (await findActiveBlock({ email: cleanEmail, ip: sourceIp })) return blockedResponse();
  const publisherStatus = await getPublisherStatus(cleanEmail);
  if (media_type === 'video' && !publisherStatus.videoEligible) {
    return NextResponse.json({ error: `Video unlocks with the Silver badge at ${publisherStatus.settings.silver_posts} posts.` }, { status: 403 });
  }
  if (duration === '2m' && !publisherStatus.trustBadge) {
    return NextResponse.json({ error: `2-month posts unlock with the Silver badge at ${publisherStatus.settings.silver_posts} posts.` }, { status: 403 });
  }
  if (duration === '3m' && publisherStatus.trustBadge !== 'gold') {
    return NextResponse.json({ error: `3-month posts unlock with the Gold badge at ${publisherStatus.settings.gold_posts} posts.` }, { status: 403 });
  }
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
  const settings = await getFeatureSettings();
  const postCountAfterPublish = publisherStatus.publishedPosts + 1;
  const trustBadge = earnedBadge(postCountAfterPublish, settings);
  let premiumBadge = publisherStatus.premiumActive;
  if (premium_payment_reference) {
    const { data: premiumIntent } = await supabaseAdmin.from('revlo_payment_intents').select('status,email,kind').eq('reference', premium_payment_reference).maybeSingle();
    premiumBadge = premiumBadge || Boolean(premiumIntent?.status === 'paid' && premiumIntent.email === cleanEmail && premiumIntent.kind === 'premium');
  }
  let promotionIntent = null;
  if (promo_payment_reference) {
    const { data: candidate } = await supabaseAdmin.from('revlo_payment_intents').select('*').eq('reference', promo_payment_reference).maybeSingle();
    if (!candidate || candidate.status !== 'paid' || candidate.email !== cleanEmail || candidate.kind !== 'promo' || candidate.post_uid || !settings.promotions_enabled) {
      await releasePublishToken(publish_token).catch(() => {});
      return NextResponse.json({ error: 'Promotion payment has not been verified.' }, { status: 402 });
    }
    promotionIntent = candidate;
  }

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

  if (promotionIntent) {
    const { data: claimedPromotion } = await supabaseAdmin.from('revlo_payment_intents')
      .update({ post_uid: uid }).eq('reference', promotionIntent.reference).is('post_uid', null).select('reference').maybeSingle();
    if (!claimedPromotion) {
      await releasePublishToken(publish_token).catch(() => {});
      return NextResponse.json({ error: 'This promotion payment has already been used.' }, { status: 409 });
    }
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
      media_type,
      video_url: media_type === 'video' ? video_url : null,
      gallery: Array.isArray(gallery) ? gallery : [],
      contact_visibility,
      followable: !!followable,
      duration,
      expires_at,
      trust_badge: trustBadge,
      premium_badge: premiumBadge,
    })
    .select(PUBLIC_COLS)
    .single();

  if (error) {
    if (promotionIntent) await supabaseAdmin.from('revlo_payment_intents').update({ post_uid: null }).eq('reference', promotionIntent.reference).eq('post_uid', uid);
    await releasePublishToken(publish_token).catch(() => {});
    console.error('[posts:POST]', error);
    return NextResponse.json({ error: 'failed to create post' }, { status: 500 });
  }

  await recordPublishTokenPost(publish_token, data.uid).catch(() => {});
  await markMagicLinkRedeemed(publish_token, data.uid).catch(() => {});
  await incrementPublisherPosts(cleanEmail).catch((e) => console.error('[publisherStats]', e));
  if (promotionIntent) {
    const endsAt = new Date(Date.now() + promotionIntent.promo_days * 86400000).toISOString();
    await supabaseAdmin.from('revlo_promotions').insert({ post_uid: data.uid, category: null, source: 'user', ends_at: endsAt, payment_reference: promotionIntent.reference });
  }

  // The publisher controls following on every post. When they turn it off,
  // the post has no follow button and existing followers receive no alert.
  if (data.followable) {
    notifyFollowers(cleanEmail, data).catch((e) =>
      console.error('[notifyFollowers]', e)
    );
  }

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
    if (await findActiveBlock({ email: f.follower_email })) continue;
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
