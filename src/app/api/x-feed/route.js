// "From X" strip (2026-10-03): cached posts for a category (visitors never trigger X calls).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { X_QUERIES } from '@/lib/xFeed.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const category = request.nextUrl.searchParams.get('category') || 'all';
  let query = supabaseAdmin.from('revlo_x_posts').select('id,category,city,text,author_name,author_username,author_avatar,media_url,posted_at').order('posted_at', { ascending: false }).limit(24);
  if (category !== 'all') {
    if (!Object.hasOwn(X_QUERIES, category)) return NextResponse.json({ posts: [] });
    query = query.eq('category', category);
  }
  const { data } = await query;
  return NextResponse.json({ posts: data || [] }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
}
