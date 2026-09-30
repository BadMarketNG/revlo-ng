import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isSnsSubscribeUrl, verifySnsMessage } from '@/lib/snsVerify';

export const dynamic = 'force-dynamic';

// POST /api/email/ses-events (2026-09-30): Amazon SES bounce and complaint
// notifications, delivered by SNS. Only signed messages from the Revlo AWS
// account's topics are accepted. Permanent bounces and complaints are stored
// in revlo_email_events for the collusion report.
const TOPIC_PREFIX = process.env.SES_EVENTS_TOPIC_PREFIX || 'arn:aws:sns:eu-west-2:617357949306:';

export async function POST(request) {
  let message;
  try {
    message = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  if (typeof message?.TopicArn !== 'string' || !message.TopicArn.startsWith(TOPIC_PREFIX)) {
    return NextResponse.json({ error: 'unknown topic' }, { status: 403 });
  }
  if (!await verifySnsMessage(message)) return NextResponse.json({ error: 'invalid signature' }, { status: 403 });

  if (message.Type === 'SubscriptionConfirmation') {
    if (!isSnsSubscribeUrl(message.SubscribeURL)) return NextResponse.json({ error: 'invalid subscribe URL' }, { status: 400 });
    const confirmed = await fetch(message.SubscribeURL, { cache: 'no-store' });
    return NextResponse.json({ ok: confirmed.ok }, { status: confirmed.ok ? 200 : 502 });
  }
  if (message.Type !== 'Notification') return NextResponse.json({ ok: true });

  let event;
  try {
    event = JSON.parse(message.Message);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const type = event.notificationType || event.eventType;
  const rows = [];
  if (type === 'Bounce' && event.bounce?.bounceType === 'Permanent') {
    for (const r of event.bounce.bouncedRecipients || []) {
      rows.push({ email: String(r.emailAddress || '').trim().toLowerCase(), event_type: 'bounce', detail: String(event.bounce.bounceSubType || '').slice(0, 100) });
    }
  } else if (type === 'Complaint') {
    for (const r of event.complaint?.complainedRecipients || []) {
      rows.push({ email: String(r.emailAddress || '').trim().toLowerCase(), event_type: 'complaint', detail: String(event.complaint.complaintFeedbackType || '').slice(0, 100) });
    }
  }
  const valid = rows.filter((row) => row.email.includes('@')).map((row) => ({ ...row, sns_message_id: message.MessageId }));
  if (valid.length) {
    const { error } = await supabaseAdmin.from('revlo_email_events').upsert(valid, { onConflict: 'sns_message_id,email', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'could not store event' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: valid.length });
}
