// "From X" refresh (2026-10-03, additive). Every 6 hours: search X per category × city block, within
// hard spending caps (daily posts, monthly dollars, 50 posts per block), reading only posts newer than
// the last seen one. Does nothing unless X_FEED_ENABLED=1. Visitors never trigger X calls.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { oauth1Header } from '@/lib/socialPost.mjs';
import { BLOCK_POST_CAP, KEEP_HOURS, blocksForRun, buildQuery, parseSearch, remainingBudget } from '@/lib/xFeed.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const SEARCH_URL = 'https://api.x.com/2/tweets/search/recent';
// Strict percent-encoding (%20, not +), matching the OAuth 1.0a signature.
const rfc3986 = params => Object.entries(params).map(([k, v]) => [k, v].map(x => encodeURIComponent(x).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('=')).join('&');

async function usage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data } = await supabaseAdmin.from('revlo_x_usage').select('day,posts_read,requests').gte('day', monthStart);
  const rows = data || [];
  return { today, todayRow: rows.find(r => r.day === today) || null, todayRead: rows.find(r => r.day === today)?.posts_read || 0, monthRead: rows.reduce((n, r) => n + (r.posts_read || 0), 0) };
}

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch { return NextResponse.json({ error: 'service unavailable' }, { status: 503 }); }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (process.env.X_FEED_ENABLED !== '1') return NextResponse.json({ ok: true, skipped: 'X_FEED_ENABLED is not 1' });
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
    const remaining = remainingBudget({ todayRead, monthRead: u.monthRead + (todayRead - u.todayRead) });
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
    const posts = parseSearch(body, block);
    todayRead += body?.data?.length || 0;
    if (posts.length) {
      const { error } = await supabaseAdmin.from('revlo_x_posts').upsert(posts, { onConflict: 'id', ignoreDuplicates: true });
      if (!error) stored += posts.length;
    }
    await supabaseAdmin.from('revlo_x_blocks').upsert({ block_key: block.key, since_id: body?.meta?.newest_id || sinceIds.get(block.key) || null, last_run: new Date().toISOString() });
    await supabaseAdmin.from('revlo_x_usage').upsert({ day: u.today, posts_read: todayRead, requests });
  }
  console.info('[cron:x-feed]', JSON.stringify({ todayRead, monthReadBefore: u.monthRead, stored, stopped }));
  return NextResponse.json({ ok: true, todayRead, stored, stopped });
}
