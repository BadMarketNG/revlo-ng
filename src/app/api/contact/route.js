import { NextResponse } from 'next/server';
import { requireHuman } from '@/lib/turnstile';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { findActiveBlock, normaliseEmail, requestIp, silentEmailSuccess } from '@/lib/revloBlocklist';
import {
  consumePendingPublicAction,
  createPendingPublicAction,
  discardPendingPublicAction,
  getPendingPublicAction,
  requireRateLimit,
} from '@/lib/security';
import { publicOrigin } from '@/lib/publicOrigin';
// NOTE (2026-10-03, Claude): support enquiries on imported jobs / X posts (additive helper).
import { supportEnquiryNote } from '@/lib/supportEnquiries.mjs';
import { MAX_CV_BYTES, validateJobApplication } from '@/lib/jobApplication.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/contact { uid, from_email, message }
// Relays a message to the poster. The poster's email is never exposed to the sender.
export async function POST(request) {
  if (request.headers.get('content-type')?.startsWith('multipart/form-data')) return submitJobApplication(request);
  // NOTE (2026-09-30): Cloudflare Turnstile — requires the browser's security check (see src/lib/turnstile.js).
  const notHuman = requireHuman(request);
  if (notHuman) return notHuman;
  const sourceIp = requestIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { uid, from_email, message } = body || {};

  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
  if (!isEmail(from_email))
    return NextResponse.json({ error: 'valid from_email required' }, { status: 400 });
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (cleanMessage.length < 2 || cleanMessage.length > 2000)
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  const sender = normaliseEmail(from_email);
  if (await findActiveBlock({ email: sender, ip: sourceIp })) return silentEmailSuccess({ pending: true });
  const ipLimited = await requireRateLimit({ action: 'contact:ip:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (ipLimited) return ipLimited;
  const emailLimited = await requireRateLimit({ action: 'contact:email:hour', key: sender, limit: 3, windowSeconds: 3600 });
  if (emailLimited) return emailLimited;
  const postLimited = await requireRateLimit({ action: 'contact:post:hour', key: uid, limit: 10, windowSeconds: 3600 });
  if (postLimited) return postLimited;

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('uid,title,category,poster_email,contact_visibility,expires_at')
    .eq('uid', uid)
    .maybeSingle();

  if (!post || new Date(post.expires_at) < new Date()) {
    return NextResponse.json({ error: 'post not available' }, { status: 404 });
  }
  if (post.contact_visibility !== 'public') {
    return NextResponse.json({ error: 'contact disabled for this post' }, { status: 403 });
  }
  // Do not create a confirmation workflow that can ultimately notify a blocked
  // post owner. The sender sees the same response as a normal request.
  if (await findActiveBlock({ email: post.poster_email })) return silentEmailSuccess({ pending: true });

  let pending;
  try {
    pending = await createPendingPublicAction({
      action: 'contact', postUid: uid, email: sender, message: cleanMessage, sourceIp,
    });
  } catch {
    return NextResponse.json({ error: 'contact verification is temporarily unavailable' }, { status: 503 });
  }
  const base = publicOrigin();
  const confirmUrl = `${base}/api/contact?token=${encodeURIComponent(pending.token)}`;
  const result = await sendEmail({
    to: sender,
    subject: post.category === 'jobs' ? 'Continue your Revlo.ng job enquiry' : 'Confirm your Revlo.ng message',
    html: `<p>${post.category === 'jobs' ? 'Open this link to add your name, date of birth, CV and short cover letter for the job poster.' : 'Confirm that you want to send a message about this Revlo.ng post.'}</p>
           <p><a href="${confirmUrl}">${post.category === 'jobs' ? 'Continue job enquiry' : 'Confirm and send message'}</a></p>
           <p>This one-time link expires in 30 minutes. If you did not request it, ignore this email.</p>`,
  });
  if (result?.ok === false) {
    await discardPendingPublicAction(pending.id);
    return NextResponse.json({ error: 'failed to send confirmation' }, { status: 502 });
  }
  return NextResponse.json({ ok: true, pending: true });
}

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token');
  const available = await getPendingPublicAction('contact', token);
  if (!available) return htmlResponse('This confirmation link is invalid or has expired.', 400);
  const { data: jobPost } = await supabaseAdmin.from('posts')
    .select('uid,title,category,contact_visibility,expires_at').eq('uid', available.post_uid).maybeSingle();
  if (jobPost?.category === 'jobs') {
    if (jobPost.contact_visibility !== 'public' || new Date(jobPost.expires_at) < new Date()) return htmlResponse('This job post is no longer available.', 410);
    return jobApplicationForm(token, jobPost);
  }
  const pending = await consumePendingPublicAction('contact', token);
  if (!pending) return htmlResponse('This confirmation link is invalid or has expired.', 400);

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('uid,title,poster_email,contact_visibility,expires_at')
    .eq('uid', pending.post_uid)
    .maybeSingle();
  if (!post || post.contact_visibility !== 'public' || new Date(post.expires_at) < new Date()) {
    return htmlResponse('This contact request is no longer available.', 410);
  }
  if (await findActiveBlock({ email: pending.email }) || await findActiveBlock({ email: post.poster_email })) {
    return htmlResponse('Your email was verified and the message has been sent.', 200);
  }
  // NOTE (2026-10-03, Claude): for posts by support@revlo.ng (imported jobs, X posts) the enquiry is recorded
  // for the admin and the email to support gets an internal "original listing" block. Empty for everyone else.
  const internalNote = await supportEnquiryNote(post, pending);
  const result = await sendEmail({
    to: post.poster_email,
    subject: `Revlo.ng: message about "${post.title}"`,
    // ORIGINAL (commented out 2026-10-03): the html below ended at the "Reply directly to" line.
    // NOTE: ${internalNote} appended (empty string except for support@revlo.ng posts).
    html: `<p>You received a verified message about your Revlo.ng post <strong>${escapeHtml(post.title)}</strong> (${post.uid}).</p>
           <p><strong>From:</strong> ${escapeHtml(pending.email)}</p>
           <p><strong>Message:</strong></p><blockquote>${escapeHtml(pending.message)}</blockquote>
           <p>Reply directly to ${escapeHtml(pending.email)} to respond.</p>${internalNote}`,
    headers: { 'Reply-To': pending.email },
  });
  if (result?.ok === false) return htmlResponse('The message could not be delivered.', 502);
  return htmlResponse('Your email was verified and the message has been sent.', 200);
}

async function submitJobApplication(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_CV_BYTES + 100000) return htmlResponse('CV must be under 4 MB.', 413);
  let form;
  try { form = await request.formData(); } catch { return htmlResponse('Could not read the application.', 400); }
  const token = String(form.get('token') || '');
  const pending = await getPendingPublicAction('contact', token);
  if (!pending) return htmlResponse('This link is invalid or has expired.', 400);
  const { data: post } = await supabaseAdmin.from('posts')
    .select('uid,title,category,poster_email,contact_visibility,expires_at').eq('uid', pending.post_uid).maybeSingle();
  if (!post || post.category !== 'jobs' || post.contact_visibility !== 'public' || new Date(post.expires_at) < new Date()) {
    return htmlResponse('This job post is no longer available.', 410);
  }
  if (form.get('consent') !== 'yes') return htmlResponse('Confirm that Revlo may email your application to the poster.', 400);
  const file = form.get('cv');
  if (!file || typeof file === 'string' || file.size > MAX_CV_BYTES) return htmlResponse('Upload a PDF or DOCX CV under 4 MB.', 400);
  const application = validateJobApplication({
    name: form.get('name'), birthDate: form.get('birth_date'), coverLetter: form.get('cover_letter'),
    filename: file.name, bytes: Buffer.from(await file.arrayBuffer()),
  });
  if (application.error) return htmlResponse(application.error, 400);
  const confirmed = await consumePendingPublicAction('contact', token);
  if (!confirmed) return htmlResponse('This link was already used or has expired.', 409);
  if (await findActiveBlock({ email: pending.email }) || await findActiveBlock({ email: post.poster_email })) {
    return htmlResponse('Your application was submitted.', 200);
  }
  const internalNote = await supportEnquiryNote(post, pending);
  const result = await sendEmail({
    to: post.poster_email,
    subject: `Revlo.ng: job application for "${post.title}"`,
    html: `<p>You received a verified job application for <strong>${escapeHtml(post.title)}</strong> (${post.uid}).</p>
           <p><strong>Name:</strong> ${escapeHtml(application.name)}<br><strong>Email:</strong> ${escapeHtml(pending.email)}<br><strong>Date of birth:</strong> ${escapeHtml(application.birthDate)}</p>
           <p><strong>Cover letter:</strong></p><blockquote>${escapeHtml(application.coverLetter).replace(/\n/g, '<br>')}</blockquote>
           <p>The applicant's CV is attached. Reply directly to ${escapeHtml(pending.email)} to respond.</p>${internalNote}`,
    headers: { 'Reply-To': pending.email },
    attachments: [{ filename: application.filename, contentType: application.contentType, content: application.bytes }],
  });
  if (result?.ok === false) return htmlResponse('The application could not be delivered. Please start a new contact request.', 502);
  return htmlResponse('Your application was sent to the job poster.', 200);
}

function jobApplicationForm(token, post) {
  const adultCutoff = new Date();
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  const latestBirthDate = adultCutoff.toISOString().slice(0, 10);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apply for ${escapeHtml(post.title)} · Revlo</title>
    <style>body{font:16px system-ui,sans-serif;background:#e9eddf;color:#26342a;margin:0;padding:24px}main{max-width:600px;margin:32px auto;background:#fffdf6;padding:clamp(20px,5vw,36px);border-radius:18px;box-shadow:0 10px 35px #203b2520}h1{font-size:27px;margin:0 0 8px}p{line-height:1.5;color:#576459}label{display:block;font-weight:650;margin:20px 0 6px}input,textarea{box-sizing:border-box;width:100%;font:inherit;padding:12px;border:1px solid #b8c6b5;border-radius:9px;background:white}textarea{min-height:130px;resize:vertical}button{background:#24563a;color:white;border:0;border-radius:9px;padding:14px 20px;font:700 16px system-ui;cursor:pointer;margin-top:20px}.check{display:flex;align-items:start;gap:10px;margin-top:18px;font-size:14px}.check input{width:auto;margin-top:4px}small{color:#637068}</style></head><body><main><strong>revlo.ng</strong><h1>Continue your job enquiry</h1><p>${escapeHtml(post.title)}</p><p>Your email is verified. Add the details below; they will be emailed privately to the poster.</p>
    <form method="post" action="/api/contact" enctype="multipart/form-data"><input type="hidden" name="token" value="${escapeHtml(token)}"><label for="name">Full name</label><input id="name" name="name" autocomplete="name" maxlength="120" required><label for="birth_date">Date of birth</label><input id="birth_date" name="birth_date" type="date" min="1900-01-01" max="${latestBirthDate}" required><label for="cv">CV (PDF or DOCX, up to 4 MB)</label><input id="cv" name="cv" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required><label for="cover_letter">Short cover letter</label><textarea id="cover_letter" name="cover_letter" minlength="40" maxlength="2000" required placeholder="Why are you interested in this role?"></textarea><label class="check"><input type="checkbox" name="consent" value="yes" required><span>I agree that Revlo may email my name, date of birth, cover letter and CV to the poster for this enquiry.</span></label><small>The link expires 30 minutes after the request. The CV is sent as an email attachment and is not published on Revlo.</small><br><button type="submit">Send application</button></form></main></body></html>`;
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
}

function htmlResponse(message, status) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Revlo.ng</h2><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  );
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
