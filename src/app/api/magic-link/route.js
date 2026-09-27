import { NextResponse } from 'next/server';
import { isEmail, signToken, verifyToken } from '@/lib/util';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { blockedResponse, findActiveBlock, normaliseEmail, requestIp } from '@/lib/revloBlocklist';

export const dynamic = 'force-dynamic';

// POST /api/magic-link { email }  -> emails a short-lived publish link.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { email } = body || {};
  if (!isEmail(email))
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  if (await findActiveBlock({ email: normaliseEmail(email), ip: requestIp(request) })) return blockedResponse();

  const token = signToken({ email: email.trim().toLowerCase(), action: 'publish' }, 30 * 60 * 1000);
  const base = process.env.APP_URL || 'https://revlo.ng';
  const link = `${base}/?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: email.trim().toLowerCase(),
    subject: 'Your Revlo.ng publish link',
    html: wrapEmail(`
      <p style="margin:0 0 16px;">Here is your one-time publish link. It expires in <strong>30 minutes</strong>.</p>
      <a href="${link}"
         style="display:inline-block;background:#6d28d9;color:#ffffff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;margin-bottom:24px;">
        Continue Publishing
      </a>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you didn't request this, you can safely ignore this email — no account was created.
      </p>
    `),
  });

  return NextResponse.json({ ok: true });
}

// GET /api/magic-link?token=...  -> verify a token (used by the create form).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const payload = verifyToken(searchParams.get('token'));
  if (!payload || payload.action !== 'publish') {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
  return NextResponse.json({ valid: true, email: payload.email });
}
