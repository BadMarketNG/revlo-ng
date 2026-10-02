// Book a viewing or call (2026-10-02): a visitor requests a slot; we email them to confirm it.
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRateLimit } from '@/lib/security';
import { requestIp } from '@/lib/revloBlocklist';
import { sendEmail } from '@/lib/email';
import { availableSlots, cleanBookingRequest } from '@/lib/bookings.mjs';
import { esc, safetyHtml, what, when } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';
const token = () => crypto.randomBytes(24).toString('base64url');

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const input = cleanBookingRequest(body);
  if (input.error) return NextResponse.json({ error: input.error }, { status: 400 });
  const uid = String(body?.uid || '');
  const limited = await requireRateLimit({ action: 'booking:ip', key: requestIp(request), limit: 10, windowSeconds: 3600 })
    || await requireRateLimit({ action: 'booking:email', key: input.value.email, limit: 5, windowSeconds: 3600 })
    || await requireRateLimit({ action: 'booking:post', key: uid, limit: 30, windowSeconds: 86400 });
  if (limited) return limited;

  const now = new Date();
  const [{ data: post }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('posts').select('uid,title,category,expires_at').eq('uid', uid).is('deleted_at', null).gt('expires_at', now.toISOString()).maybeSingle(),
    supabaseAdmin.from('revlo_booking_settings').select('*').eq('post_uid', uid).maybeSingle(),
  ]);
  if (!post || !settings) return NextResponse.json({ error: 'This post does not take bookings.' }, { status: 404 });
  if (!settings.modes.includes(input.value.mode)) return NextResponse.json({ error: `This post does not take ${input.value.mode === 'call' ? 'calls' : 'viewings'}.` }, { status: 400 });
  const { data: taken } = await supabaseAdmin.from('revlo_bookings').select('slot_start').eq('post_uid', uid).in('status', ['requested', 'accepted']).gte('slot_start', now.toISOString());
  const free = availableSlots(settings, { now: now.getTime(), expiresAt: post.expires_at, taken: (taken ?? []).map(t => t.slot_start) });
  if (!free.includes(input.value.slot)) return NextResponse.json({ error: 'That time is no longer free. Please choose another.' }, { status: 409 });

  const booking = { post_uid: uid, mode: input.value.mode, slot_start: input.value.slot, name: input.value.name, email: input.value.email, phone: input.value.phone, note: input.value.note, visitor_token: token(), poster_token: token() };
  const { error } = await supabaseAdmin.from('revlo_bookings').insert(booking);
  if (error) { console.error('[bookings:POST]', error.code || error.message); return NextResponse.json({ error: 'Could not save your request. Please try again.' }, { status: 500 }); }
  const confirmUrl = `https://revlo.ng/api/bookings/confirm?token=${booking.visitor_token}`;
  const result = await sendEmail({
    to: booking.email,
    subject: `Confirm your ${what(booking, post?.category)} request: ${post.title}`.slice(0, 150),
    html: `<p>Hi ${esc(booking.name)}, confirm your request for a <strong>${what(booking, post?.category)}</strong> on <strong>${esc(when(booking))}</strong> (Lagos time) about <strong>${esc(post.title)}</strong>.</p>
           <p><a href="${confirmUrl}">Confirm and send my request</a></p>
           <p>Once confirmed, the poster gets your name, phone number and email and can accept or decline. We will email you their answer.</p>${safetyHtml()}`,
  });
  if (result?.ok === false) {
    await supabaseAdmin.from('revlo_bookings').delete().eq('visitor_token', booking.visitor_token);
    return NextResponse.json({ error: 'We could not send the confirmation email. Check the address and try again.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
