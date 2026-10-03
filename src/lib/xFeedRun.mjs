// The X feed refresh (2026-10-03): shared by the scheduled job and the admin "Run now" button.
// Reads X within the budget (period, month and per-run caps), keeps only posts matching each search, and
// publishes them as Revlo posts by support@revlo.ng.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { randomUUID } from 'node:crypto';
import { oauth1Header } from '@/lib/socialPost.mjs';
import { makeUid, expiryFor } from '@/lib/util';
import { notifyIndexNow } from '@/lib/indexNow.mjs';
import { BLOCK_POST_CAP, KEEP_HOURS, getXSearches, getXSettings, isRelevant, matchesSearch, parseSearch, periodStartFor, remainingFor, searchBlocks, searchQuery, xToPost } from '@/lib/xFeed.mjs';

const SEARCH_URL = 'https://api.x.com/2/tweets/search/recent';
const X_POSTER = 'support@revlo.ng';
// Strict percent-encoding (%20, not +), matching the OAuth 1.0a signature.
const rfc3986 = params => Object.entries(params).map(([k, v]) => [k, v].map(x => encodeURIComponent(x).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('=')).join('&');

export async function xUsage(settings) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const periodFrom = periodStartFor(settings.periodDays);
  const from = periodFrom < monthStart ? periodFrom : monthStart;
  const { data } = await supabaseAdmin.from('revlo_x_usage').select('day,posts_read,requests').gte('day', from);
  const rows = data || [];
  const sum = list => list.reduce((n, r) => n + (r.posts_read || 0), 0);
  const todayRow = rows.find(r => r.day === today) || null;
  return {
    today, periodFrom,
    todayRead: todayRow?.posts_read || 0, todayRequests: todayRow?.requests || 0,
    periodRead: sum(rows.filter(r => r.day >= periodFrom)),
    monthRead: sum(rows.filter(r => r.day >= monthStart)),
  };
}

/** Publishes saved X posts that have no Revlo post yet (fetched in the last 24 hours). */
export async function publishAsPosts(limit = 300) {
  const { data: pending } = await supabaseAdmin.from('revlo_x_posts').select('*').is('post_uid', null)
    .gt('fetched_at', new Date(Date.now() - 24 * 3600000).toISOString()).order('posted_at', { ascending: false }).limit(limit);
  const created = [];
  // Posts from admin searches were matched when fetched; older ones use the built-in relevance check.
  for (const item of (pending || []).filter(p => p.search_id || isRelevant(p))) {
    const uid = makeUid();
    const { data: claimed } = await supabaseAdmin.from('revlo_x_posts').update({ post_uid: uid }).eq('id', item.id).is('post_uid', null).select('id').maybeSingle();
    if (!claimed) continue;
    const { error } = await supabaseAdmin.from('posts').insert({
      uid, poster_email: X_POSTER, ...xToPost(item), media_type: 'images',
      contact_visibility: 'public', followable: true, duration: 'now', expires_at: expiryFor('now'), trust_badge: null, premium_badge: false,
    });
    if (error) { await supabaseAdmin.from('revlo_x_posts').update({ post_uid: null }).eq('id', item.id); console.error('[x-feed] post', error.code || error.message); continue; }
    created.push(uid);
  }
  if (created.length) await notifyIndexNow(created.map(u => `https://revlo.ng/p/${u}`));
  return created.length;
}

export async function runXFeed() {
  const settings = await getXSettings(supabaseAdmin);
  if (!settings.enabled) return { skipped: 'X feed is switched off', published: await publishAsPosts() };
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) return { skipped: 'no X keys', published: await publishAsPosts() };

  // The cron and admin Run now share one lease. The conditional UPDATE is atomic:
  // a second run cannot read the same budget and overwrite the first run's usage.
  const owner = randomUUID();
  const { data: lease, error: leaseError } = await supabaseAdmin.from('revlo_x_run_lock')
    .update({ owner, expires_at: new Date(Date.now() + 120000).toISOString() })
    .eq('id', true).lt('expires_at', new Date().toISOString()).select('owner').maybeSingle();
  if (leaseError) throw new Error(`X feed lock unavailable: ${leaseError.message}`);
  if (!lease) return { skipped: 'another X refresh is running' };
  try {
  await supabaseAdmin.from('revlo_x_posts').delete().lt('fetched_at', new Date(Date.now() - KEEP_HOURS * 3600000).toISOString());
  const u = await xUsage(settings);
  let runRead = 0, requests = u.todayRequests, stored = 0, stopped = null;
  const searches = await getXSearches(supabaseAdmin);
  const { data: blockRows } = await supabaseAdmin.from('revlo_x_blocks').select('block_key,since_id');
  const sinceIds = new Map((blockRows || []).map(b => [b.block_key, b.since_id]));
  const started = Date.now();
  for (const block of searchBlocks(searches, Math.floor(Date.now() / (6 * 3600000)))) {
    if (Date.now() - started > 45000) { stopped = 'time'; break; }
    const remaining = remainingFor(settings, { periodRead: u.periodRead + runRead, monthRead: u.monthRead + runRead, runRead });
    if (remaining < 10) { stopped = 'spending cap'; break; } // X returns at least 10 posts per request
    const params = {
      query: searchQuery(block.search, block.city),
      max_results: String(Math.min(BLOCK_POST_CAP, remaining, 100)),
      'tweet.fields': 'created_at,author_id,attachments',
      expansions: 'author_id,attachments.media_keys',
      'user.fields': 'name,username,profile_image_url',
      'media.fields': 'url,preview_image_url,type',
      ...(sinceIds.get(block.key) ? { since_id: sinceIds.get(block.key) } : {}),
    };
    const authorization = oauth1Header({ method: 'GET', url: SEARCH_URL, params, consumerKey: X_API_KEY, consumerSecret: X_API_SECRET, token: X_ACCESS_TOKEN, tokenSecret: X_ACCESS_SECRET });
    let response;
    try { response = await fetch(`${SEARCH_URL}?${rfc3986(params)}`, { headers: { Authorization: authorization }, signal: AbortSignal.timeout(12000) }); } catch { continue; }
    requests += 1;
    if (response.status === 429 || response.status === 402 || response.status === 403) { stopped = `X answered ${response.status}`; break; }
    if (!response.ok) continue;
    const body = await response.json().catch(() => null);
    runRead += body?.data?.length || 0;
    const posts = parseSearch(body, { category: block.search.category, city: block.city })
      .map(p => ({ ...p, block_key: block.key, search_id: block.search.id }))
      .filter(p => matchesSearch(p, block.search));
    if (posts.length) {
      const { error } = await supabaseAdmin.from('revlo_x_posts').upsert(posts, { onConflict: 'id', ignoreDuplicates: true });
      if (!error) stored += posts.length;
    }
    await supabaseAdmin.from('revlo_x_blocks').upsert({ block_key: block.key, since_id: body?.meta?.newest_id || sinceIds.get(block.key) || null, last_run: new Date().toISOString() });
    await supabaseAdmin.from('revlo_x_usage').upsert({ day: u.today, posts_read: u.todayRead + runRead, requests });
  }
  const published = await publishAsPosts();
  const result = { read: runRead, periodRead: u.periodRead + runRead, stored, published, stopped };
  console.info('[x-feed]', JSON.stringify(result));
  return result;
  } finally {
    await supabaseAdmin.from('revlo_x_run_lock')
      .update({ owner: null, expires_at: new Date(0).toISOString() }).eq('id', true).eq('owner', owner);
  }
}
