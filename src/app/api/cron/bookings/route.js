// Book a viewing or call (2026-10-02): morning reminders for today's accepted bookings (both sides).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { sendEmail } from '@/lib/email';
import { esc, safetyHtml, what, when } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch { return NextResponse.json({ error: 'service unavailable' }, { status: 503 }); }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const now = Date.now();
  const { data: bookings } = await supabaseAdmin.from('revlo_bookings').select('*').eq('status', 'accepted').is('reminded_at', null)
    .gte('slot_start', new Date(now).toISOString()).lte('slot_start', new Date(now + 24 * 3600000).toISOString()).limit(1000);
  let sent = 0;
  for (const booking of bookings ?? []) {
    const { data: post } = await supabaseAdmin.from('posts').select('title,poster_email').eq('uid', booking.post_uid).maybeSingle();
    const title = esc(post?.title || booking.post_uid);
    await sendEmail({ to: booking.email, subject: `Reminder: ${what(booking)} ${when(booking)}`, html: `<p>Reminder: your <strong>${what(booking)}</strong> about <strong>${title}</strong> is on <strong>${esc(when(booking))}</strong> (Lagos time).</p><p><a href="https://revlo.ng/api/bookings/cancel?token=${booking.visitor_token}">Can't make it? Cancel</a></p>${safetyHtml()}` });
    if (post?.poster_email) await sendEmail({ to: post.poster_email, subject: `Reminder: ${what(booking)} with ${booking.name} ${when(booking)}`.slice(0, 150), html: `<p>Reminder: <strong>${esc(booking.name)}</strong> (${esc(booking.phone)}) has a <strong>${what(booking)}</strong> about <strong>${title}</strong> on <strong>${esc(when(booking))}</strong> (Lagos time).</p>` });
    await supabaseAdmin.from('revlo_bookings').update({ reminded_at: new Date().toISOString() }).eq('id', booking.id);
    sent += 1;
  }
  return NextResponse.json({ ok: true, reminded: sent });
}
