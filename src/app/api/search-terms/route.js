// Search ticker (2026-10-02): GET returns the ticker and the term pool used for autocomplete;
// POST counts one search. Additive feature; it does not change how the feed itself searches.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRateLimit } from '@/lib/security';
import { requestIp } from '@/lib/revloBlocklist';
import { STARTER_TERMS, buildTicker, decayedScore, normaliseTerm } from '@/lib/searchTicker.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const [{ data: posts }, { data: searched }] = await Promise.all([
    supabaseAdmin.from('posts').select('tags, created_at, expires_at').is('deleted_at', null).gt('expires_at', nowIso).neq('tags', '{}').order('created_at', { ascending: false }).limit(2000),
    supabaseAdmin.from('revlo_search_terms').select('term, search_count, score, score_at').order('last_searched_at', { ascending: false }).limit(2000),
  ]);

  // The public pool: tags on live posts plus the starter list. Searched words only add weight to
  // terms already in the pool, so nobody can put arbitrary text into the ticker by searching it.
  const pool = new Map();
  for (const term of STARTER_TERMS) pool.set(term, { term, score: 0, count: 0, newestAt: 0 });
  for (const post of posts ?? []) {
    const at = new Date(post.created_at).getTime();
    const ends = new Date(post.expires_at).getTime();
    for (const raw of post.tags ?? []) {
      const term = normaliseTerm(raw);
      if (!term) continue;
      const entry = pool.get(term) ?? { term, score: 0, count: 0, newestAt: 0 };
      entry.newestAt = Math.max(entry.newestAt, at);
      // NOTE (2026-10-03): when the soonest-ending live post with this tag expires (for "ending soon").
      if (ends > now) entry.endingAt = Math.min(entry.endingAt ?? Infinity, ends);
      pool.set(term, entry);
    }
  }
  for (const row of searched ?? []) {
    const entry = pool.get(row.term);
    if (!entry) continue;
    entry.score = decayedScore(row.score, row.score_at, now);
    entry.count = Number(row.search_count) || 0;
  }

  const list = [...pool.values()];
  const ticker = buildTicker(list, now);
  return NextResponse.json({
    ticker: ticker.items,
    label: ticker.hasSearchData ? 'Popular' : 'Try',
    pool: list.map(p => ({ term: p.term, score: Math.round(p.score * 100) / 100, count: p.count })).slice(0, 600),
  }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
}

export async function POST(request) {
  const limited = await requireRateLimit({ action: 'search_term', key: requestIp(request), limit: 60, windowSeconds: 600 });
  if (limited) return limited;
  const body = await request.json().catch(() => null);
  const term = normaliseTerm(body?.term);
  if (!term) return NextResponse.json({ ok: false }, { status: 422 });
  const { error } = await supabaseAdmin.rpc('revlo_record_search', { p_term: term });
  if (error) {
    console.error('[search-terms:POST]', error.code || error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
