// Book a viewing or call (2026-10-02): the visitor cancels (GET shows a button; POST acts).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { esc, page, what, when } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';

async function load(token) {
  if (!/^[\w-]{20,64}$/.test(token || '')) return null;
  const { data } = await supabaseAdmin.from('revlo_bookings').select('*').eq('visitor_token', token).maybeSingle();
  return data;
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token');
  const booking = await load(token);
  if (!booking) return page('Link not valid', '<h1>Link not valid</h1>');
  if (!['requested', 'accepted'].includes(booking.status)) return page('Booking', `<h1>This booking is ${esc(booking.status)}</h1>`);
  return page('Cancel booking', `<h1>Cancel your ${what(booking)}?</h1><p>${esc(when(booking))} (Lagos time)</p><form method="post" class="btns"><input type="hidden" name="token" value="${esc(token)}"><button class="no">Yes, cancel it</button></form>`);
}

export async function POST(request) {
  const token = String((await request.formData()).get('token') || '');
  const booking = await load(token);
  if (!booking || !['requested', 'accepted'].includes(booking.status)) return page('Nothing changed', '<h1>Nothing changed</h1>');
  await supabaseAdmin.from('revlo_bookings').update({ status: 'cancelled', decided_at: new Date().toISOString() }).eq('id', booking.id);
  const { data: post } = await supabaseAdmin.from('posts').select('title,category,poster_email').eq('uid', booking.post_uid).maybeSingle();
  if (post?.poster_email) await sendEmail({ to: post.poster_email, subject: `Cancelled: ${what(booking, post?.category)} on ${when(booking)} — ${post.title}`.slice(0, 150), html: `<p>${esc(booking.name)} cancelled the <strong>${what(booking, post?.category)}</strong> on <strong>${esc(when(booking))}</strong> about <strong>${esc(post.title)}</strong>. The time is free again.</p>` });
  return page('Cancelled', '<h1>Cancelled</h1><p>We have let the poster know. The time is free again.</p>');
}
