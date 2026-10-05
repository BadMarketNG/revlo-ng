// Social posting cron (2026-10-02, additive): once a day (06:30 UTC = 7:30 am Lagos), post a
// "Today on Revlo" summary of the last 24 hours to Revlo's Facebook Page and X account.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { buildDigest, buildShortDigest, postToFacebook, postToX, socialCardForCounts } from '@/lib/socialPost.mjs';
import { headline } from '@/lib/outcomes.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch { return NextResponse.json({ error: 'service unavailable' }, { status: 503 }); }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const now = new Date();
  const { data: posts } = await supabaseAdmin.from('posts').select('uid,category').is('deleted_at', null).gt('expires_at', now.toISOString()).gt('created_at', new Date(now.getTime() - 86400000).toISOString()).limit(5000);
  const counts = {};
  for (const post of posts ?? []) counts[post.category] = (counts[post.category] || 0) + 1;
  const { count: bookable } = (posts ?? []).length
    ? await supabaseAdmin.from('revlo_booking_settings').select('post_uid', { count: 'exact', head: true }).in('post_uid', posts.map(p => p.uid).slice(0, 1000))
    : { count: 0 };
  const link = 'https://revlo.ng/app.html?utm_source=social&utm_medium=daily';
  const { data: shared } = await supabaseAdmin.from('revlo_outcomes').select('outcome,label,hours').eq('share', true).gt('resolved_at', new Date(now.getTime() - 86400000).toISOString()).order('hours').limit(3);
  const results = (shared ?? []).map(r => `${headline(r.outcome, Number(r.hours))}: ${r.label}`);
  const long = buildDigest(counts, { url: link, bookable: bookable || 0, results });
  const card = socialCardForCounts(counts, now.getTime());
  const short = buildShortDigest(counts, { url: `https://revlo.ng/today/${card.slug}` });
  if (!long) return NextResponse.json({ ok: true, posted: false, reason: 'no new posts' });
  const [facebook, x] = await Promise.all([
    postToFacebook(long, link).catch(e => ({ ok: false, error: e?.name })),
    postToX(short).catch(e => ({ ok: false, error: e?.name })),
  ]);
  console.info('[cron:social]', JSON.stringify({ counts, facebook, x }));
  return NextResponse.json({ ok: true, counts, facebook, x });
}
