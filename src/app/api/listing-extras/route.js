// Listing extras (2026-10-02): which posts take bookings, and their structured details, for cards.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { liveBumps } from '@/lib/bumps.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const uids = (new URL(request.url).searchParams.get('uids') || '').split(',').map(u => u.trim()).filter(u => /^[A-Za-z0-9-]{4,24}$/.test(u)).slice(0, 100);
  if (!uids.length) return NextResponse.json({ booking: {}, details: {} });
  const [{ data: settings }, { data: details }, bumped] = await Promise.all([
    supabaseAdmin.from('revlo_booking_settings').select('post_uid,modes').in('post_uid', uids),
    supabaseAdmin.from('revlo_post_details').select('post_uid,details').in('post_uid', uids),
    liveBumps(supabaseAdmin).catch(() => []),
  ]);
  return NextResponse.json({
    booking: Object.fromEntries((settings ?? []).map(s => [s.post_uid, s.modes])),
    details: Object.fromEntries((details ?? []).map(d => [d.post_uid, d.details])),
    bumped: bumped.filter(uid => uids.includes(uid)),
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
