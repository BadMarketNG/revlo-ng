// Book a viewing or call (2026-10-02): calendar file for an accepted booking (either side's link).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildIcs } from '@/lib/eventsFeed.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[\w-]{20,64}$/.test(token)) return new Response('Not found', { status: 404 });
  const { data: booking } = await supabaseAdmin.from('revlo_bookings').select('*').or(`visitor_token.eq.${token},poster_token.eq.${token}`).eq('status', 'accepted').maybeSingle();
  if (!booking) return new Response('Not found', { status: 404 });
  const { data: settings } = await supabaseAdmin.from('revlo_booking_settings').select('slot_minutes').eq('post_uid', booking.post_uid).maybeSingle();
  const { data: post } = await supabaseAdmin.from('posts').select('title,location').eq('uid', booking.post_uid).maybeSingle();
  const forPoster = booking.poster_token === token;
  const end = new Date(new Date(booking.slot_start).getTime() + (settings?.slot_minutes || 30) * 60000).toISOString();
  const ics = buildIcs([{ uid: `booking-${booking.id}`, title: `Revlo ${booking.mode}: ${post?.title || booking.post_uid}`, summary: forPoster ? `${booking.name} · ${booking.phone}` : 'Booked on Revlo.ng. Never pay before you have seen it in person.', start: booking.slot_start, end, venue: booking.mode === 'call' ? 'Phone call' : '', location: post?.location || '', url: `https://revlo.ng/p/${booking.post_uid}`, created_at: booking.created_at }]);
  return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="revlo-booking.ics"', 'Cache-Control': 'no-store' } });
}
