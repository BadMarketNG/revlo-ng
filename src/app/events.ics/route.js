// Events calendar feed (2026-10-02, additive): https://revlo.ng/events.ics
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { parseEvent } from '@/lib/listingMarkup.mjs';
import { buildIcs } from '@/lib/eventsFeed.mjs';

export const revalidate = 900;

export async function GET() {
  const now = new Date();
  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('uid,title,description,location,created_at')
    .eq('category', 'promotions')
    .is('deleted_at', null)
    .gt('expires_at', now.toISOString())
    .order('created_at', { ascending: false })
    .limit(500);
  const events = (posts ?? []).map(post => {
    const event = parseEvent(post.description);
    if (!event || new Date(event.end || event.start) < now) return null;
    return { ...event, uid: post.uid, title: post.title, summary: String(post.description || '').split('\n')[0].slice(0, 300), location: post.location, url: `https://revlo.ng/p/${post.uid}`, created_at: post.created_at };
  }).filter(Boolean).sort((a, b) => a.start.localeCompare(b.start));
  return new Response(buildIcs(events, now), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  });
}
