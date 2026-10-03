// "From X" refresh (2026-10-03, additive). Every 6 hours: search X per category × city block, within
// hard spending caps (daily posts, monthly dollars, 50 posts per block), reading only posts newer than
// the last seen one. Does nothing unless X_FEED_ENABLED=1. Visitors never trigger X calls.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { oauth1Header } from '@/lib/socialPost.mjs';
import { BLOCK_POST_CAP, KEEP_HOURS, blocksForRun, buildQuery, isRelevant, parseSearch, periodStart, remainingBudget, xToPost } from '@/lib/xFeed.mjs';
import { makeUid, expiryFor } from '@/lib/util';
import { notifyIndexNow } from '@/lib/indexNow.mjs';

// NOTE (2026-10-03, owner's request): relevant X posts are published as Revlo posts by support@revlo.ng.
const X_POSTER = 'support@revlo.ng';

// Publishes cached X posts that do not have a Revlo post yet (newest first), within the last 24 hours.
async function publishAsPosts(limit = 40) {
  const { data: pending } = await supabaseAdmin.from('revlo_x_posts').select('*').is('post_uid', null)
    .gt('fetched_at', new Date(Date.now() - 24 * 3600000).toISOString()).order('posted_at', { ascending: false }).limit(limit);
  const created = [];
  for (const item of (pending || []).filter(isRelevant)) {
    const uid = makeUid();
    // Claim first so a repeated run cannot publish the same X post twice.
    const { data: claimed } = await supabaseAdmin.from('revlo_x_posts').update({ post_uid: uid }).eq('id', item.id).is('post_uid', null).select('id').maybeSingle();
    if (!claimed) continue;
    const { error } = await supabaseAdmin.from('posts').insert({
      uid, poster_email: X_POSTER, ...xToPost(item), media_type: 'images', gallery: [],
      contact_visibility: 'private', followable: false, duration: 'now', expires_at: expiryFor('now'), trust_badge: null, premium_badge: false,
    });
    if (error) { await supabaseAdmin.from('revlo_x_posts').update({ post_uid: null }).eq('id', item.id); console.error('[cron:x-feed] post', error.code || error.message); continue; }
    created.push(uid);
  }
  if (created.length) await notifyIndexNow(created.map(u => `https://revlo.ng/p/${u}`));
  return created.length;
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const SEARCH_URL = 'https://api.x.com/2/tweets/search/recent';
// Strict percent-encoding (%20, not +), matching the OAuth 1.0a signature.
const rfc3986 = params => Object.entries(params).map(([k, v]) => [k, v].map(x => encodeURIComponent(x).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('=')).join('&');

async function usage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const periodFrom = periodStart();
  const from = periodFrom < monthStart ? periodFrom : monthStart;
  const { data } = await supabaseAdmin.from('revlo_x_usage').select('day,posts_read,requests').gte('day', from);
  const rows = data || [];
  const todayRow = rows.find(r => r.day === today) || null;
  // NOTE (2026-10-03): the cap now covers a budget period (default 3 days), not a single day.
  const periodRead = rows.filter(r => r.day >= periodFrom).reduce((n, r) => n + (r.posts_read || 0), 0);
  return { today, todayRow, todayStored: todayRow?.posts_read || 0, todayRead: periodRead, monthRead: rows.filter(r => r.day >= monthStart).reduce((n, r) => n + (r.posts_read || 0), 0) };
}

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch { return NextResponse.json({ error: 'service unavailable' }, { status: 503 }); }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (process.env.X_FEED_ENABLED !== '1') return NextResponse.json({ ok: true, skipped: 'X_FEED_ENABLED is not 1', published: await publishAsPosts() });
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) return NextResponse.json({ ok: true, skipped: 'no X keys' });

  // Old posts go first (kept 48 hours).
  await supabaseAdmin.from('revlo_x_posts').delete().lt('fetched_at', new Date(Date.now() - KEEP_HOURS * 3600000).toISOString());

  const u = await usage();
  let todayRead = u.todayRead, requests = u.todayRow?.requests || 0, stored = 0, stopped = null;
  const { data: blockRows } = await supabaseAdmin.from('revlo_x_blocks').select('block_key,since_id');
  const sinceIds = new Map((blockRows || []).map(b => [b.block_key, b.since_id]));
  const runIndex = Math.floor(Date.now() / (6 * 3600000));
  const started = Date.now();

  for (const block of blocksForRun(runIndex)) {
    if (Date.now() - started > 45000) { stopped = 'time'; break; }
    const remaining = remainingBudget({ todayRead, monthRead: u.monthRead + (todayRead - u.todayRead), runRead: todayRead - u.todayRead });
    // X returns at least 10 posts per request, so never start one that could pass the cap.
    if (remaining < 10) { stopped = 'spending cap'; break; }
    const params = {
      query: buildQuery(block.category, block.city),
      max_results: String(Math.min(BLOCK_POST_CAP, remaining, 100)),
      'tweet.fields': 'created_at,author_id,attachments',
      expansions: 'author_id,attachments.media_keys',
      'user.fields': 'name,username,profile_image_url',
      'media.fields': 'url,preview_image_url,type',
      ...(sinceIds.get(block.key) ? { since_id: sinceIds.get(block.key) } : {}),
    };
    const authorization = oauth1Header({ method: 'GET', url: SEARCH_URL, params, consumerKey: X_API_KEY, consumerSecret: X_API_SECRET, token: X_ACCESS_TOKEN, tokenSecret: X_ACCESS_SECRET });
    let response;
    try { response = await fetch(`${SEARCH_URL}?${rfc3986(params)}`, { headers: { Authorization: authorization }, signal: AbortSignal.timeout(12000) }); }
    catch { continue; }
    requests += 1;
    if (response.status === 429 || response.status === 402 || response.status === 403) { stopped = `X answered ${response.status}`; break; }
    if (!response.ok) continue;
    const body = await response.json().catch(() => null);
    // Only posts that really are listings for this category and city are kept.
    const posts = parseSearch(body, block).filter(isRelevant);
    todayRead += body?.data?.length || 0;
    if (posts.length) {
      const { error } = await supabaseAdmin.from('revlo_x_posts').upsert(posts, { onConflict: 'id', ignoreDuplicates: true });
      if (!error) stored += posts.length;
    }
    await supabaseAdmin.from('revlo_x_blocks').upsert({ block_key: block.key, since_id: body?.meta?.newest_id || sinceIds.get(block.key) || null, last_run: new Date().toISOString() });
    // Today's row keeps today's reads only (the period total is the sum of its days).
    await supabaseAdmin.from('revlo_x_usage').upsert({ day: u.today, posts_read: u.todayStored + (todayRead - u.todayRead), requests });
  }
  const published = await publishAsPosts();
  console.info('[cron:x-feed]', JSON.stringify({ todayRead, monthReadBefore: u.monthRead, stored, published, stopped }));
  return NextResponse.json({ ok: true, todayRead, stored, published, stopped });
}
