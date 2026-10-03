// Report a scam contact (2026-10-03, additive). POST (multipart): the report and up to two screenshots.
// Same safeguards as post reports: the browser's security check, rate limits, blocked reporters get a
// silent success, and the reporter confirms their email before an administrator sees the report.
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { requireHuman } from '@/lib/turnstile';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { findActiveBlock, requestIp, silentEmailSuccess } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';
import { detectUploadType } from '@/lib/securityPrimitives.mjs';
import { CONTACT_METHODS, SCAM_TYPES, cleanEmail, cleanPhone, hashValue } from '@/lib/scamReports.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const BUCKET = 'report-evidence';
const MAX_FILES = 2;
const MAX_FILE_BYTES = 500 * 1024;
const fail = (error, status = 400) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const notHuman = requireHuman(request);
  if (notHuman) return notHuman;
  if (Number(request.headers.get('content-length') || 0) > 1_200_000) return fail('The screenshots are too large.', 413);
  let form;
  try { form = await request.formData(); } catch { return fail('Expected a report form.'); }
  const sourceIp = requestIp(request);
  const reporter = cleanEmail(form.get('reporter_email'));
  if (!reporter) return fail('Enter your email address so we can confirm the report.');
  const method = String(form.get('contact_method') || '');
  const scamType = String(form.get('scam_type') || '');
  if (!CONTACT_METHODS.includes(method) || !SCAM_TYPES.includes(scamType)) return fail('Choose how they contacted you and what happened.');
  const rawEmail = String(form.get('subject_email') || '').trim();
  const rawPhone = String(form.get('subject_phone') || '').trim();
  const subjectEmail = rawEmail ? cleanEmail(rawEmail) : null;
  const subjectPhone = rawPhone ? cleanPhone(rawPhone) : null;
  const subjectHandle = String(form.get('subject_handle') || '').trim().slice(0, 120) || null;
  if (rawEmail && !subjectEmail) return fail('Check their email address.');
  if (rawPhone && !subjectPhone) return fail('Check their phone number (include the country code).');
  if (!subjectEmail && !subjectPhone && !subjectHandle) return fail('Add their email address, phone number or account name.');
  if (subjectEmail && subjectEmail === reporter) return fail('You cannot report your own email address.');
  const details = String(form.get('details') || '').trim();
  if (details.length < 20 || details.length > 1500) return fail('Describe what happened in 20 to 1,500 characters.');
  const postUid = String(form.get('post_uid') || '').trim().toUpperCase().slice(0, 24) || null;
  const money = Number(String(form.get('money_lost') || '').replace(/[^\d.]/g, '')) || null;
  const currency = money ? String(form.get('currency') || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || null : null;
  const files = form.getAll('evidence').filter(f => f && typeof f !== 'string' && f.size > 0);
  if (files.length > MAX_FILES) return fail('Add no more than two screenshots.');

  if (await findActiveBlock({ email: reporter, ip: sourceIp })) return silentEmailSuccess({ pending: true });
  const limited = await requireRateLimit({ action: 'scam-report:ip:hour', key: sourceIp, limit: 5, windowSeconds: 3600 })
    || await requireRateLimit({ action: 'scam-report:email:day', key: reporter, limit: 5, windowSeconds: 86400 });
  if (limited) return limited;

  const id = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString('base64url');
  const uploads = [];
  try {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) return fail('Each screenshot must be 500 KB or smaller.');
      const bytes = Buffer.from(await file.arrayBuffer());
      const detected = detectUploadType(bytes);
      if (!detected || !['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime)) return fail('Screenshots must be JPEG, PNG or WebP images.');
      const key = `scam/${id}/${crypto.randomUUID()}.${detected.extension}`;
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(key, bytes, { contentType: detected.mime, cacheControl: '0', upsert: false });
      if (error) throw new Error('upload failed');
      uploads.push(key);
    }
    const { error } = await supabaseAdmin.from('revlo_scam_reports').insert({
      id, reporter_email: reporter, reporter_ip: sourceIp || null, contact_method: method, scam_type: scamType,
      subject_email: subjectEmail, subject_email_hash: subjectEmail ? hashValue(subjectEmail) : null,
      subject_phone: subjectPhone, subject_phone_hash: subjectPhone ? hashValue(subjectPhone) : null,
      subject_handle: subjectHandle, post_uid: postUid, details, money_lost: money, currency, attachments: uploads, token,
    });
    if (error) throw new Error(error.code || 'insert failed');
  } catch (error) {
    if (uploads.length) await supabaseAdmin.storage.from(BUCKET).remove(uploads);
    console.error('[scam-reports]', error.message);
    return fail('Could not save the report. Please try again.', 500);
  }
  const link = `https://revlo.ng/api/scam-reports/confirm?token=${token}`;
  const delivery = await sendEmail({
    to: reporter,
    subject: 'Confirm your Revlo.ng scam report',
    html: wrapEmail(`<p>Confirm your report so our team can review it.</p><p><a href="${link}">Confirm my report</a></p><p>If you did not send a report, ignore this email and nothing will happen.</p>`),
  });
  if (delivery?.ok === false) {
    await supabaseAdmin.from('revlo_scam_reports').delete().eq('id', id);
    if (uploads.length) await supabaseAdmin.storage.from(BUCKET).remove(uploads);
    return fail('We could not send the confirmation email. Check the address and try again.', 502);
  }
  return NextResponse.json({ ok: true, pending: true }, { headers: { 'Cache-Control': 'no-store' } });
}
