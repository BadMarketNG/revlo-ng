// Partner feed (2026-10-02): outside listings and headlines for the feed, by category.
// Cached for 15 minutes so the sources are called a few times an hour at most (BOQQS asks for
// no more than every 15 minutes; news feeds change about as often).
import { NextResponse } from 'next/server';
import { NEWS_FEEDS, USER_AGENT, fromBoqqs, fromJooble, mixSources, ogImage, parseRss } from '@/lib/partnerFeed.mjs';

export const revalidate = 900;

const CATEGORIES = ['all', 'jobs', 'rentals', 'for_sale', 'promotions', 'general'];
// A fresh 8-second timeout for every request (a shared signal would expire once and abort all later calls).
const fetchOptions = () => ({ headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, application/rss+xml, text/xml' }, next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) });

async function boqqsJobs() {
  try {
    const response = await fetch('https://boqqs.com/api/v1/jobs?country=NG&per_page=50', fetchOptions());
    if (!response.ok) return [];
    const body = await response.json();
    return (body.jobs ?? []).map(fromBoqqs).filter(Boolean);
  } catch { return []; }
}

// Jooble: one search for jobs in Nigeria, cached 6 hours and shared by every visitor (about four
// calls a day against the 500-request allowance). Switches on when JOOBLE_API_KEY is set.
async function joobleJobs() {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return [];
  try {
    const response = await fetch(`https://jooble.org/api/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ keywords: '', location: 'Nigeria' }),
      cache: 'force-cache',
      next: { revalidate: 21600, tags: ['jooble'] },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) { console.error('[partner-feed:jooble]', response.status); return []; }
    const body = await response.json();
    return (body.jobs ?? []).map(fromJooble).filter(Boolean);
  } catch (error) { console.error('[partner-feed:jooble]', error?.name || 'failed'); return []; }
}

async function newsHeadlines() {
  const results = await Promise.all(NEWS_FEEDS.map(async feed => {
    try {
      const response = await fetch(feed.url, fetchOptions());
      if (!response.ok) return [];
      return parseRss(await response.text(), feed.name).slice(0, 25);
    } catch { return []; }
  }));
  return results.flat();
}

// Items whose feed has no image (Punch, some Channels TV): read the article's og:image, the picture
// the publisher chose for link previews. Cached for a day; only the items being shown are looked up.
async function addMissingImages(items) {
  await Promise.all(items.filter(item => !item.image && item.kind === 'news').slice(0, 24).map(async item => {
    try {
      const response = await fetch(item.url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
      if (!response.ok) return;
      // The share image is in the page head; the first part of the page is enough.
      const head = (await response.text()).slice(0, 200_000);
      item.image = ogImage(head);
    } catch { /* keep the card without an image */ }
  }));
  return items;
}

export async function GET(request) {
  const category = new URL(request.url).searchParams.get('category') || 'all';
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: 'invalid category' }, { status: 400 });
  const wantJobs = category === 'all' || category === 'jobs';
  const [jobs, jooble, news] = await Promise.all([
    wantJobs ? boqqsJobs() : [],
    wantJobs ? joobleJobs() : [],
    category === 'all' || category === 'general' ? newsHeadlines() : [],
  ]);
  const items = await addMissingImages(mixSources([...jobs, ...jooble, ...news], category === 'all' ? 40 : 60));
  return NextResponse.json({ category, items }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } });
}
