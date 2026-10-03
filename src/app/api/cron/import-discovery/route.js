// Curated Nigeria-only Dating articles and approved short-stay listings.
// External feeds are never allowed to create contactable personal profiles.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { makeUid, expiryFor } from '@/lib/util';
import { notifyIndexNow } from '@/lib/indexNow.mjs';
import { hash, JOB_ICONS } from '@/lib/jobImport.mjs';
import { parseRss, USER_AGENT } from '@/lib/partnerFeed.mjs';
import { DATING_FEEDS, DISCOVERY_POSTER, datingItem, shortletItem, raypropItem } from '@/lib/discoveryImport.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PER_SOURCE = { 'zikoko-love-life': 3, 'kisses-and-huggs': 3, shortlet: 6, rayprop: 6 };
const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json' };

async function fetchDating(feed) {
  const response = await fetch(feed.url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml' }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok || Number(response.headers.get('content-length') || 0) > 3_000_000) throw new Error(`${feed.id} feed unavailable`);
  const xml = await response.text();
  if (xml.length > 3_000_000) throw new Error(`${feed.id} feed too large`);
  return parseRss(xml, feed.name).map(item => datingItem(item, feed)).filter(Boolean);
}

function liveShortletBase() {
  try {
    const url = new URL(process.env.SHORTLET_API_BASE_URL || '');
    return url.protocol === 'https:' && url.hostname === 'api.shortlet.app' && !url.username && !url.password ? url.origin : null;
  } catch { return null; }
}

async function fetchShortlet() {
  const key = process.env.SHORTLET_PARTNER_API_KEY;
  const base = liveShortletBase();
  if (!key || !base) return [];
  const url = new URL('/v1/api/partner/properties', base);
  url.search = new URLSearchParams({ country: 'Nigeria', page: '1', limit: '20', sort: '-createdAt' }).toString();
  const response = await fetch(url, { headers: { ...headers, 'X-API-Key': key }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Shortlet API answered ${response.status}`);
  const body = await response.json();
  if (body?.status !== true || !Array.isArray(body?.data?.result)) throw new Error('Shortlet API response changed');
  return body.data.result.map(item => shortletItem(item)).filter(Boolean);
}

async function fetchRayprop() {
  const key = process.env.RAYPROP_API_KEY;
  if (!key) return [];
  const all = [];
  for (const city of ['Lagos', 'Abuja']) {
    const url = new URL('https://api.rayprop.io/functions/v1/complete-api/listings');
    url.search = new URLSearchParams({ city, limit: '20' }).toString();
    const response = await fetch(url, { headers: { ...headers, 'X-API-Key': key }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`RayProp API answered ${response.status}`);
    const body = await response.json();
    const rows = Array.isArray(body?.data) ? body.data : body?.data?.results;
    if (!Array.isArray(rows)) throw new Error('RayProp API response changed');
    all.push(...rows.map(item => raypropItem(item)).filter(Boolean));
  }
  return all;
}

async function publish(item) {
  const { error: claimError } = await supabaseAdmin.from('revlo_discovery_imports').insert({ source: item.source, external_id: item.externalId, source_url: item.sourceUrl });
  if (claimError) return null; // The source item was already imported in this period.
  const seed = hash(`${item.source}:${item.externalId}`);
  const headers = item.category === 'lodging' ? ['rentals-2', 'rentals-3', 'rentals-5'] : ['general-1', 'general-3', 'general-4'];
  const uid = makeUid();
  const post = {
    uid, poster_email: DISCOVERY_POSTER, title: item.title, description: item.description,
    location: item.location, category: item.category,
    header_url: item.photos[0] || `https://revlo.ng/samples/headers/${headers[seed % headers.length]}.jpg`,
    thumb_url: `https://revlo.ng/samples/icons/icon-${JOB_ICONS[(seed >> 3) % JOB_ICONS.length]}.jpg`,
    media_type: 'images', gallery: item.photos.slice(1), contact_visibility: 'private', followable: false,
    duration: item.duration, expires_at: expiryFor(item.duration), trust_badge: null, premium_badge: false,
    tags: [item.category, 'nigeria'],
  };
  const { error } = await supabaseAdmin.from('posts').insert(post);
  if (error) {
    console.error('[cron:import-discovery] insert', item.source, error.code || error.message);
    await supabaseAdmin.from('revlo_discovery_imports').delete().eq('source', item.source).eq('external_id', item.externalId);
    return null;
  }
  await supabaseAdmin.from('revlo_discovery_imports').update({ post_uid: uid }).eq('source', item.source).eq('external_id', item.externalId);
  return uid;
}

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch { return NextResponse.json({ error: 'service unavailable' }, { status: 503 }); }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sources = [...DATING_FEEDS.map(feed => [feed.id, () => fetchDating(feed)]), ['shortlet', fetchShortlet], ['rayprop', fetchRayprop]];
  const imported = {};
  const newUids = [];
  for (const [name, load] of sources) {
    try {
      imported[name] = 0;
      const items = await load();
      for (const item of items.slice(0, MAX_PER_SOURCE[name])) {
        const uid = await publish(item);
        if (uid) { imported[name] += 1; newUids.push(uid); }
      }
    } catch (error) { console.error('[cron:import-discovery]', name, error?.message || error); }
  }
  if (newUids.length) await notifyIndexNow(newUids.map(uid => `https://revlo.ng/p/${uid}`));
  return NextResponse.json({ ok: true, imported, lodgingConfigured: Boolean(process.env.RAYPROP_API_KEY || (process.env.SHORTLET_PARTNER_API_KEY && liveShortletBase())) });
}
