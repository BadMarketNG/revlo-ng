import { NextResponse } from 'next/server';
import { isEmail, signToken, verifyToken } from '@/lib/util';
import { sendEmail } from '@/lib/email';

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

  const token = signToken({ email: email.trim().toLowerCase(), action: 'publish' }, 30 * 60 * 1000);
  const base = process.env.APP_URL || 'https://revlong.vercel.app';

  await sendEmail({
    to: email.trim().toLowerCase(),
    subject: 'Your Revlo.ng publish link',
    html: `<p>Click to verify your email and continue publishing on Revlo.ng. Expires in 30 minutes.</p>
           <p><a href="${base}/?token=${encodeURIComponent(token)}">Continue to publish</a></p>`,
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
