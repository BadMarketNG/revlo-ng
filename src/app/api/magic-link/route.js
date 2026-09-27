import { NextResponse } from 'next/server';
import { isEmail, signToken, verifyToken } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { blockedResponse, findActiveBlock, normaliseEmail, requestIp } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';
import { isPublishTokenUsed } from '@/lib/publishToken';

export const dynamic = 'force-dynamic';

// POST /api/magic-link { email }  -> emails a short-lived publish link.
export async function POST(request) {
  const sourceIp = requestIp(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { email } = body || {};
  if (!isEmail(email))
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  const cleanEmail = normaliseEmail(email);
  if (await findActiveBlock({ email: cleanEmail, ip: sourceIp })) return blockedResponse();
  const ipLimited = await requireRateLimit({ action: 'magic-link:ip:15m', key: sourceIp, limit: 5, windowSeconds: 900 });
  if (ipLimited) return ipLimited;
  const emailLimited = await requireRateLimit({ action: 'magic-link:email:hour', key: cleanEmail, limit: 3, windowSeconds: 3600 });
  if (emailLimited) return emailLimited;

  let token;
  try {
    token = signToken({ email: cleanEmail, action: 'publish' }, 30 * 60 * 1000);
  } catch (error) {
    console.error('[magic-link]', error.message);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  const base = process.env.APP_URL || 'https://revlo.ng';
  const link = `${base}/?token=${encodeURIComponent(token)}`;

  const sent = await sendEmail({
    to: cleanEmail,
    subject: 'Your Revlo.ng publish link',
    html: wrapEmail(`
      <p style="margin:0 0 16px;">Here is your one-time publish link. It expires in <strong>30 minutes</strong>.</p>
      <a href="${link}"
         style="display:inline-block;background:#1B5E20;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:24px;">
        Continue Publishing
      </a>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you didn't request this, you can safely ignore this email — no account was created.
      </p>
    `),
  });
  if (sent.ok === false) {
    return NextResponse.json({ error: 'Could not send the email. Try again shortly.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

// GET /api/magic-link?token=...  -> verify a token (used by the create form).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const payload = verifyToken(token);
  if (!payload || payload.action !== 'publish') {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  let used;
  try {
    used = await isPublishTokenUsed(token);
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  if (used) return NextResponse.json({ valid: false, used: true }, { status: 410 });
  return NextResponse.json({ valid: true, email: payload.email });
}
