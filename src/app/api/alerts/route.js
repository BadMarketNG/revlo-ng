// Alert me (2026-10-02, additive): POST creates an alert and emails a confirmation link.
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRateLimit } from '@/lib/security';
import { requestIp } from '@/lib/revloBlocklist';
import { sendEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/adminPublishers';
import { MAX_ALERTS_PER_EMAIL, cleanAlert, describeAlert } from '@/lib/alerts.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const input = cleanAlert(body);
  if (input.error) return NextResponse.json({ error: input.error }, { status: 400 });
  const alert = input.value;
  // Limits stop the form being used to send confirmation emails to someone else repeatedly.
  const limited = await requireRateLimit({ action: 'alert:ip', key: requestIp(request), limit: 10, windowSeconds: 3600 })
    || await requireRateLimit({ action: 'alert:email', key: alert.email, limit: 3, windowSeconds: 3600 });
  if (limited) return limited;

  const { count } = await supabaseAdmin.from('revlo_alerts').select('id', { count: 'exact', head: true })
    .eq('email', alert.email).is('unsubscribed_at', null);
  if ((count ?? 0) >= MAX_ALERTS_PER_EMAIL) {
    return NextResponse.json({ error: `You already have ${MAX_ALERTS_PER_EMAIL} alerts. Unsubscribe from one (link in any alert email) to add another.` }, { status: 409 });
  }
  const token = crypto.randomBytes(24).toString('base64url');
  const { error } = await supabaseAdmin.from('revlo_alerts').insert({ ...alert, token });
  if (error) {
    console.error('[alerts:POST]', error.code || error.message);
    return NextResponse.json({ error: 'Could not save your alert. Please try again.' }, { status: 500 });
  }
  const confirmUrl = `https://revlo.ng/api/alerts/confirm?token=${token}`;
  const result = await sendEmail({
    to: alert.email,
    subject: 'Confirm your Revlo.ng alert',
    html: `<p>Confirm that you want an email once a day about <strong>${escapeHtml(describeAlert(alert))}</strong> on Revlo.ng.</p>
           <p><a href="${confirmUrl}">Confirm my alert</a></p>
           <p>If you did not ask for this, ignore this email and nothing will be sent.</p>`,
  });
  if (result?.ok === false) {
    await supabaseAdmin.from('revlo_alerts').delete().eq('token', token);
    return NextResponse.json({ error: 'We could not send the confirmation email. Check the address and try again.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
