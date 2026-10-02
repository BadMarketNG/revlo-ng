// Book a viewing or call (2026-10-02): the visitor confirms; the request goes to the poster.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { esc, safetyHtml, what, when } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';
const back = state => NextResponse.redirect(`https://revlo.ng/app.html?booking=${state}`, 303);

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[\w-]{20,64}$/.test(token)) return back('invalid');
  const { data: booking } = await supabaseAdmin.from('revlo_bookings').select('*').eq('visitor_token', token).maybeSingle();
  if (!booking) return back('invalid');
  if (booking.status !== 'unconfirmed') return back('done');
  if (new Date(booking.slot_start) < new Date()) return back('past');
  // The unique index refuses this if someone else confirmed the same slot first.
  const { error } = await supabaseAdmin.from('revlo_bookings').update({ status: 'requested', confirmed_at: new Date().toISOString() }).eq('id', booking.id).eq('status', 'unconfirmed');
  if (error) return back('taken');
  const { data: post } = await supabaseAdmin.from('posts').select('uid,title,poster_email').eq('uid', booking.post_uid).maybeSingle();
  if (post?.poster_email) {
    const decideUrl = `https://revlo.ng/api/bookings/decide?token=${booking.poster_token}`;
    await sendEmail({
      to: post.poster_email,
      subject: `New ${what(booking)} request: ${when(booking)} — ${post.title}`.slice(0, 150),
      html: `<p><strong>${esc(booking.name)}</strong> would like a <strong>${what(booking)}</strong> on <strong>${esc(when(booking))}</strong> (Lagos time) about your Revlo.ng post <strong>${esc(post.title)}</strong> (${esc(post.uid)}).</p>
             <p>Phone: <strong>${esc(booking.phone)}</strong><br>Email: ${esc(booking.email)}${booking.note ? `<br>Note: ${esc(booking.note)}` : ''}</p>
             <p><a href="${decideUrl}">Accept or decline this request</a></p>
             <p style="color:#888;font-size:13px">Your email stays hidden unless you reply to them yourself. If you do nothing, the time stays held for them.</p>${safetyHtml()}`,
      headers: { 'Reply-To': booking.email },
    });
  }
  return back('sent');
}
