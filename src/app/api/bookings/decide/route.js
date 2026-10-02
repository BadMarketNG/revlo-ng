// Book a viewing or call (2026-10-02): the poster accepts, declines or cancels.
// GET shows the choice (email scanners open links; they must not accept bookings); POST acts.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { esc, page, safetyHtml, what, when } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';

async function load(token) {
  if (!/^[\w-]{20,64}$/.test(token || '')) return {};
  const { data: booking } = await supabaseAdmin.from('revlo_bookings').select('*').eq('poster_token', token).maybeSingle();
  if (!booking) return {};
  const { data: post } = await supabaseAdmin.from('posts').select('uid,title').eq('uid', booking.post_uid).maybeSingle();
  return { booking, post };
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token');
  const { booking, post } = await load(token);
  if (!booking) return page('Link not valid', '<h1>Link not valid</h1><p>This booking link is not valid.</p>');
  const summary = `<p><strong>${esc(booking.name)}</strong> · ${esc(booking.phone)} · ${esc(booking.email)}<br>${what(booking)} on <strong>${esc(when(booking))}</strong> (Lagos time)<br>About: ${esc(post?.title || booking.post_uid)}</p>`;
  const form = actions => `<form method="post" class="btns"><input type="hidden" name="token" value="${esc(token)}">${actions}</form>`;
  if (booking.status === 'requested') return page('Booking request', `<h1>Booking request</h1>${summary}${form('<button class="ok" name="action" value="accept">Accept</button><button class="no" name="action" value="decline">Decline</button>')}${safetyHtml()}`);
  if (booking.status === 'accepted') return page('Booking accepted', `<h1>You accepted this booking</h1>${summary}<p><a href="https://revlo.ng/api/bookings/ics?token=${esc(token)}">Add to my calendar</a></p>${form('<button class="no" name="action" value="cancel">Cancel this booking</button>')}${safetyHtml()}`);
  return page('Booking', `<h1>This booking is ${esc(booking.status)}</h1>${summary}`);
}

export async function POST(request) {
  const form = await request.formData();
  const token = String(form.get('token') || '');
  const action = String(form.get('action') || '');
  const { booking, post } = await load(token);
  if (!booking) return page('Link not valid', '<h1>Link not valid</h1>');
  const next = { accept: ['requested', 'accepted'], decline: ['requested', 'declined'], cancel: ['accepted', 'cancelled'] }[action];
  if (!next || booking.status !== next[0]) return page('Already done', `<h1>Nothing changed</h1><p>This booking is ${esc(booking.status)}.</p>`);
  await supabaseAdmin.from('revlo_bookings').update({ status: next[1], decided_at: new Date().toISOString() }).eq('id', booking.id).eq('status', next[0]);
  const title = post?.title || booking.post_uid;
  const rebook = `https://revlo.ng/app.html?book=${encodeURIComponent(booking.post_uid)}`;
  const messages = {
    accepted: { subject: `Booked: ${what(booking)} on ${when(booking)} — ${title}`, html: `<p>Good news: your <strong>${what(booking)}</strong> on <strong>${esc(when(booking))}</strong> (Lagos time) about <strong>${esc(title)}</strong> is accepted.</p><p>${booking.mode === 'call' ? 'Expect the call on the number you gave.' : 'The poster will contact you on the number you gave with the exact address.'}</p><p><a href="https://revlo.ng/api/bookings/ics?token=${booking.visitor_token}">Add to my calendar</a> · <a href="https://revlo.ng/api/bookings/cancel?token=${booking.visitor_token}">Cancel</a></p>${safetyHtml()}` },
    declined: { subject: `Not available: ${when(booking)} — ${title}`, html: `<p>Sorry, the poster cannot do <strong>${esc(when(booking))}</strong> for <strong>${esc(title)}</strong>.</p><p><a href="${rebook}">Choose another time</a></p>` },
    cancelled: { subject: `Cancelled: ${what(booking)} on ${when(booking)} — ${title}`, html: `<p>The poster has cancelled the <strong>${what(booking)}</strong> on <strong>${esc(when(booking))}</strong> about <strong>${esc(title)}</strong>.</p><p><a href="${rebook}">Choose another time</a></p>` },
  }[next[1]];
  await sendEmail({ to: booking.email, subject: messages.subject.slice(0, 150), html: messages.html });
  const done = { accepted: 'Accepted. We have emailed them. They will expect your contact on their phone number.', declined: 'Declined. We have let them know and offered other times.', cancelled: 'Cancelled. We have let them know.' }[next[1]];
  return page('Done', `<h1>${esc(done.split('.')[0])}</h1><p>${esc(done)}</p>${next[1] === 'accepted' ? `<p><a href="https://revlo.ng/api/bookings/ics?token=${esc(token)}">Add to my calendar</a></p>` : ''}`);
}
