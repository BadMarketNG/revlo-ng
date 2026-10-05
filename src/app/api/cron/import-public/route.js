// Revlo-owned public-page collector. X remains in its existing capped importer.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { expiryFor, makeUid } from '@/lib/util';
import { notifyIndexNow } from '@/lib/indexNow.mjs';
import { pickSupportStock } from '@/lib/supportStock.mjs';
import { DISCOVERY_POSTER } from '@/lib/discoveryImport.mjs';
import { facebookEmbedUrl, facebookListingItems, myJobMagItems, propertyCentreItems } from '@/lib/publicPageScrape.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CITIES = [
  { name: 'Lagos', job: 'lagos', property: 'lagos', cap: 8 },
  { name: 'Abuja', job: 'abuja', property: 'abuja', cap: 3 },
  { name: 'Port Harcourt', job: 'rivers', property: 'rivers/port-harcourt', cap: 1 },
];
const MAX_NEW = 12;
const MAX_PER_SOURCE = { myjobmag: 6, nigeriapropertycentre: 6, facebook: 3 };

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RevloPublicListings/1.0; +https://revlo.ng)', Accept: 'text/html' },
    cache: 'no-store', signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Page answered ${response.status}`);
  if (Number(response.headers.get('content-length')) > 1500000) throw new Error('Page too large');
  const html = await response.text();
  if (html.length > 1500000) throw new Error('Page too large');
  return html;
}

async function collect(now) {
  const tasks = CITIES.flatMap(city => [
    { source: 'myjobmag', city: city.name, url: `https://www.myjobmag.com/jobs-location/${city.job}`, parse: myJobMagItems },
    { source: 'nigeriapropertycentre', city: city.name, url: `https://nigeriapropertycentre.com/for-rent/${city.property}`, parse: propertyCentreItems },
  ]);
  const facebookPages = [...new Set((process.env.REVLO_PUBLIC_FACEBOOK_PAGES || 'https://www.facebook.com/JobbermanNigeria')
    .split(/[\s,]+/).map(facebookEmbedUrl).filter(Boolean))].slice(0, 5);
  tasks.push(...facebookPages.map(url => ({ source: 'facebook', url, parse: facebookListingItems })));
  const results = await Promise.allSettled(tasks.map(async task => {
    const html = await fetchPage(task.url);
    return task.city ? task.parse(html, task.city, now) : task.parse(html, now);
  }));
  const candidates = [];
  const failures = [];
  for (let index = 0; index < tasks.length; index += 1) {
    const result = results[index];
    if (result.status === 'fulfilled') candidates.push(...result.value);
    else failures.push(`${tasks[index].source}:${tasks[index].city || 'page'}`);
  }
  return { candidates, failures };
}

function orderCandidates(items) {
  const rank = { Lagos: 0, Abuja: 1, 'Port Harcourt': 2 };
  return [...items].sort((a, b) => (rank[a.city] ?? 9) - (rank[b.city] ?? 9)
    || (a.category === 'jobs' ? 0 : 1) - (b.category === 'jobs' ? 0 : 1));
}

async function publish(item, usedImages) {
  const image = item.image || pickSupportStock(item.category, item.title, usedImages);
  if (!image || usedImages.has(image)) return null;
  const { error: claimError } = await supabaseAdmin.from('revlo_discovery_imports')
    .insert({ source: item.source, external_id: item.externalId, source_url: item.sourceUrl });
  if (claimError) {
    if (claimError.code !== '23505') console.error('[cron:import-public] claim', item.source, claimError.code || claimError.message);
    return null;
  }
  const uid = makeUid();
  const { error } = await supabaseAdmin.from('posts').insert({
    uid, poster_email: DISCOVERY_POSTER, title: item.title, description: item.description,
    location: item.location, category: item.category,
    header_url: image, thumb_url: 'https://revlo.ng/samples/icons/icon-01.jpg',
    media_type: 'images', gallery: [], contact_visibility: 'public', followable: true,
    duration: 'now', expires_at: expiryFor('now'), trust_badge: null, premium_badge: false,
    tags: [item.category, item.city.toLowerCase()].filter(tag => /^[a-z][a-z ]{1,30}$/.test(tag)),
  });
  if (error) {
    console.error('[cron:import-public] insert', item.source, error.code || error.message);
    await supabaseAdmin.from('revlo_discovery_imports').delete().eq('source', item.source).eq('external_id', item.externalId);
    return null;
  }
  await supabaseAdmin.from('revlo_discovery_imports').update({ post_uid: uid })
    .eq('source', item.source).eq('external_id', item.externalId);
  usedImages.add(image);
  return uid;
}

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch { return NextResponse.json({ error: 'service unavailable' }, { status: 503 }); }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { candidates, failures } = await collect(Date.now());
  if (request.nextUrl.searchParams.get('preview') === '1') {
    return NextResponse.json({ ok: true, candidates: candidates.length, bySource: Object.fromEntries(['myjobmag', 'nigeriapropertycentre', 'facebook'].map(source => [source, candidates.filter(item => item.source === source).length])), failures, sample: orderCandidates(candidates).slice(0, 8).map(({ source, city, title }) => ({ source, city, title })) });
  }
  const { data: live, error: liveError } = await supabaseAdmin.from('posts').select('header_url')
    .eq('poster_email', DISCOVERY_POSTER).is('deleted_at', null).gt('expires_at', new Date().toISOString()).limit(1000);
  if (liveError) return NextResponse.json({ error: 'Could not check active images' }, { status: 503 });
  const usedImages = new Set((live || []).map(row => row.header_url).filter(Boolean));
  const added = [];
  const byCity = Object.fromEntries(CITIES.map(city => [city.name, 0]));
  const bySource = { myjobmag: 0, nigeriapropertycentre: 0, facebook: 0 };
  for (const item of orderCandidates(candidates)) {
    if (added.length >= MAX_NEW) break;
    if (byCity[item.city] >= CITIES.find(city => city.name === item.city)?.cap) continue;
    if (bySource[item.source] >= MAX_PER_SOURCE[item.source]) continue;
    const uid = await publish(item, usedImages);
    if (!uid) continue;
    added.push(uid);
    byCity[item.city] += 1;
    bySource[item.source] += 1;
  }
  if (added.length) await notifyIndexNow(added.map(uid => `https://revlo.ng/p/${uid}`));
  console.info('[cron:import-public]', JSON.stringify({ candidates: candidates.length, published: added.length, bySource, failures }));
  return NextResponse.json({ ok: true, candidates: candidates.length, published: added.length, bySource, failures });
}
