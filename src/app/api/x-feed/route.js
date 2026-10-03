// "From X" strip (2026-10-03): cached posts for a category (visitors never trigger X calls).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SHOWN_FOR, isRelevant } from '@/lib/xFeed.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const category = request.nextUrl.searchParams.get('category') || 'all';
  // Read more than needed and show only relevant posts (also hides anything saved before the filter existed).
  let query = supabaseAdmin.from('revlo_x_posts').select('id,category,city,text,author_name,author_username,author_avatar,media_url,posted_at').order('posted_at', { ascending: false }).limit(200);
  // NOTE (2026-10-03): only the four focus groups are shown (jobs, rent, items for sale, politics).
  const groups = SHOWN_FOR[category];
  if (!groups) return NextResponse.json({ posts: [] });
  query = query.in('category', groups);
  const { data } = await query;
  return NextResponse.json({ posts: (data || []).filter(isRelevant).slice(0, 24) }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
}
