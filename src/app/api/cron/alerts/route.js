// Alert me cron (2026-10-02, additive): once a day, email each confirmed alert the new posts that
// match it since its last email (at most 10 per email). Runs after the job import.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { sendEmail } from '@/lib/email';
import { escapeHtml } from '@/lib/adminPublishers';
import { describeAlert, matches } from '@/lib/alerts.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch (error) {
    console.error('[cron:alerts]', error.message);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();
  const [{ data: alerts }, { data: posts }] = await Promise.all([
    supabaseAdmin.from('revlo_alerts').select('id,email,category,area,keyword,token,last_sent_at').not('confirmed_at', 'is', null).is('unsubscribed_at', null).limit(5000),
    supabaseAdmin.from('posts').select('uid,title,description,location,category,created_at').is('deleted_at', null).gt('expires_at', now.toISOString()).gt('created_at', dayAgo).order('created_at', { ascending: false }).limit(2000),
  ]);
  let sent = 0;
  for (const alert of alerts ?? []) {
    const since = alert.last_sent_at && alert.last_sent_at > dayAgo ? alert.last_sent_at : dayAgo;
    const found = (posts ?? []).filter(post => post.created_at > since && matches(alert, post));
    if (!found.length) continue;
    const unsubscribeUrl = `https://revlo.ng/api/alerts/unsubscribe?token=${alert.token}`;
    const items = found.slice(0, 10).map(post => `<li style="margin:0 0 12px"><a href="https://revlo.ng/p/${post.uid}" style="color:#1b5e20;font-weight:700">${escapeHtml(post.title)}</a><br><span style="color:#666">${escapeHtml(post.location || '')}</span></li>`).join('');
    const result = await sendEmail({
      to: alert.email,
      subject: `${found.length} new on Revlo.ng: ${describeAlert(alert)}`.slice(0, 150),
      html: `<p>New since your last alert: <strong>${escapeHtml(describeAlert(alert))}</strong>.</p>
             <ul style="padding-left:18px">${items}</ul>
             ${found.length > 10 ? `<p><a href="https://revlo.ng/app.html">See all ${found.length} on Revlo.ng</a></p>` : ''}
             <p style="color:#888;font-size:13px">Posts expire, so open the ones you like soon. <a href="${unsubscribeUrl}">Unsubscribe from this alert</a>.</p>`,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    if (result?.ok !== false) {
      await supabaseAdmin.from('revlo_alerts').update({ last_sent_at: now.toISOString() }).eq('id', alert.id);
      sent += 1;
    }
  }
  console.info('[cron:alerts]', 'alerts', alerts?.length ?? 0, 'emails', sent);
  return NextResponse.json({ ok: true, sent });
}
