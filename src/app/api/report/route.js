import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { addAutomaticBlocks, findActiveBlock, normaliseEmail, requestIp, silentEmailSuccess } from '@/lib/revloBlocklist';
import { actionTokenHash, consumePendingPublicAction, createPendingPublicAction, discardPendingPublicAction, getPendingPublicAction, requireRateLimit } from '@/lib/security';
import { detectUploadType } from '@/lib/securityPrimitives.mjs';
import { publicOrigin } from '@/lib/publicOrigin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const VALID_REASONS = ['spam', 'false_info', 'offensive', 'copyright', 'other'];
const BUCKET = 'report-evidence';
const MAX_FILES = 2;
const MAX_FILE_BYTES = 500 * 1024;
const MAX_REQUEST_BYTES = 1_200_000;

function noStore(body, init) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

async function findLivePost(uid) {
  const { data } = await supabaseAdmin.from('posts')
    .select('id,uid,title,poster_email,source_ip,expires_at,deleted_at')
    .eq('uid', uid).maybeSingle();
  return data && !data.deleted_at && new Date(data.expires_at) > new Date() ? data : null;
}

async function requestVerification(request, body) {
  const sourceIp = requestIp(request);
  const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!uid) return noStore({ error: 'uid required' }, { status: 400 });
  if (!isEmail(body.email)) return noStore({ error: 'valid email required' }, { status: 400 });
  const email = normaliseEmail(body.email);

  if (await findActiveBlock({ email, ip: sourceIp })) return silentEmailSuccess({ pending: true });
  const ipLimited = await requireRateLimit({ action: 'report-request:ip:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (ipLimited) return ipLimited;
  const emailLimited = await requireRateLimit({ action: 'report-request:email:hour', key: email, limit: 4, windowSeconds: 3600 });
  if (emailLimited) return emailLimited;
  const postLimited = await requireRateLimit({ action: 'report-request:post:hour', key: uid, limit: 20, windowSeconds: 3600 });
  if (postLimited) return postLimited;

  const post = await findLivePost(uid);
  if (!post) return noStore({ error: 'post not available' }, { status: 404 });
  let pending;
  try {
    pending = await createPendingPublicAction({ action: 'report', postUid: uid, email, sourceIp });
  } catch {
    return noStore({ error: 'report verification is temporarily unavailable' }, { status: 503 });
  }

  const link = `${publicOrigin()}/app.html?report_token=${encodeURIComponent(pending.token)}`;
  const delivery = await sendEmail({
    to: email,
    subject: 'Verify your email to report a Revlo.ng post',
    html: wrapEmail(`
      <p>Confirm your email address before choosing what to report about <strong>${escapeHtml(post.title)}</strong>.</p>
      <p><a href="${link}">Continue your report</a></p>
      <p>This one-time link expires in 30 minutes. If you did not request it, ignore this email.</p>
    `),
  });
  if (delivery?.ok === false) {
    await discardPendingPublicAction(pending.id);
    return noStore({ error: 'Could not send the verification email. Try again shortly.' }, { status: 502 });
  }
  return noStore({ ok: true, pending: true });
}

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  const pending = await getPendingPublicAction('report', token);
  if (!pending) return noStore({ valid: false, error: 'This report link is invalid or has expired.' }, { status: 400 });
  const post = await findLivePost(pending.post_uid);
  if (!post) return noStore({ valid: false, error: 'This post is no longer available.' }, { status: 410 });
  return noStore({ valid: true, uid: post.uid, title: post.title, email: pending.email });
}

async function submitReport(request) {
  const sourceIp = requestIp(request);
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) return noStore({ error: 'Evidence upload is too large.' }, { status: 413 });
  let form;
  try {
    form = await request.formData();
  } catch {
    return noStore({ error: 'Expected report form data.' }, { status: 400 });
  }
  const token = String(form.get('token') || '');
  const reason = String(form.get('reason') || '');
  const details = String(form.get('details') || '').trim();
  if (!VALID_REASONS.includes(reason)) return noStore({ error: 'Choose what you are reporting.' }, { status: 400 });
  if (details.length > 1000) return noStore({ error: 'Report details must be 1,000 characters or fewer.' }, { status: 400 });

  const pending = await getPendingPublicAction('report', token);
  if (!pending) return noStore({ error: 'This report link is invalid or has expired.' }, { status: 400 });
  const post = await findLivePost(pending.post_uid);
  if (!post) return noStore({ error: 'This post is no longer available.' }, { status: 410 });
  const files = form.getAll('evidence').filter((file) => file && typeof file !== 'string' && file.size > 0);
  if (files.length > MAX_FILES) return noStore({ error: 'Upload no more than two images.' }, { status: 400 });

  if (await findActiveBlock({ email: pending.email, ip: sourceIp })) {
    await consumePendingPublicAction('report', token);
    return silentEmailSuccess();
  }
  const limited = await requireRateLimit({ action: 'report-submit:ip:hour', key: sourceIp, limit: 10, windowSeconds: 3600 });
  if (limited) return limited;

  const uploads = [];
  try {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) throw new ReportInputError('Each image must be 500 KB or smaller.');
      const bytes = Buffer.from(await file.arrayBuffer());
      const detected = detectUploadType(bytes);
      if (!detected || !['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime)) {
        throw new ReportInputError('Evidence must be a JPEG, PNG, or WebP image.');
      }
      const key = `reports/${pending.id}/${crypto.randomUUID()}.${detected.extension}`;
      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(key, bytes, {
        contentType: detected.mime, cacheControl: '0', upsert: false,
      });
      if (error) throw new Error('evidence upload failed');
      uploads.push(key);
    }

    const { data, error } = await supabaseAdmin.rpc('submit_verified_revlo_report', {
      p_token_hash: actionTokenHash(token), p_reason: reason, p_details: details,
      p_attachments: uploads, p_reporter_ip: sourceIp || null,
    });
    if (error) throw new Error(error.message || 'report submission failed');
    if (data?.duplicate && uploads.length) await supabaseAdmin.storage.from(BUCKET).remove(uploads);

    const { count } = await supabaseAdmin.from('reports').select('*', { count: 'exact', head: true })
      .eq('post_id', post.id).not('reporter_email', 'is', null);
    if ((count || 0) >= 3) {
      await supabaseAdmin.from('posts').update({ deleted_at: new Date().toISOString() })
        .eq('id', post.id).is('deleted_at', null);
      await addAutomaticBlocks({
        email: post.poster_email, ip: post.source_ip,
        reason: 'A post reached three independently email-verified reports',
        source: 'report_threshold', durationMs: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return noStore({ ok: true, duplicate: Boolean(data?.duplicate) });
  } catch (error) {
    if (uploads.length) await supabaseAdmin.storage.from(BUCKET).remove(uploads);
    if (error instanceof ReportInputError) return noStore({ error: error.message }, { status: 400 });
    console.error('[report:submit]', error.message);
    return noStore({ error: 'Could not submit this report. Please try again.' }, { status: 500 });
  }
}

export async function POST(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('multipart/form-data')) return submitReport(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: 'invalid JSON' }, { status: 400 });
  }
  if (body?.action !== 'request_verification') return noStore({ error: 'verification required' }, { status: 400 });
  return requestVerification(request, body);
}

class ReportInputError extends Error {}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
