// Book a viewing or call (2026-10-02): free slots for one post.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { availableSlots, bookingSettingsFor } from '@/lib/bookings.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const uid = new URL(request.url).searchParams.get('uid') || '';
  const now = new Date();
  const [{ data: post }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('posts').select('uid,title,location,category,post_type,expires_at').eq('uid', uid).is('deleted_at', null).gt('expires_at', now.toISOString()).maybeSingle(),
    supabaseAdmin.from('revlo_booking_settings').select('*').eq('post_uid', uid).maybeSingle(),
  ]);
  const bookingSettings = bookingSettingsFor(post, settings);
  if (!post || !bookingSettings) return NextResponse.json({ error: 'This post does not take bookings.' }, { status: 404 });
  const { data: taken } = await supabaseAdmin.from('revlo_bookings').select('slot_start').eq('post_uid', uid).in('status', ['requested', 'accepted']).gte('slot_start', now.toISOString());
  return NextResponse.json({
    title: post.title, location: post.location, category: post.category, modes: bookingSettings.modes, slotMinutes: bookingSettings.slot_minutes,
    proposed: bookingSettings.proposed,
    slots: availableSlots(bookingSettings, { now: now.getTime(), expiresAt: bookingSettings.proposed ? new Date(now.getTime() + 7 * 86400000) : post.expires_at, taken: (taken ?? []).map(t => t.slot_start) }),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
