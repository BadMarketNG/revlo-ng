import { NextResponse } from 'next/server';
import { requestIp } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';
import { humanPassCookie, turnstileEnabled, verifyTurnstileToken } from '@/lib/turnstile';

export const dynamic = 'force-dynamic';

// GET  /api/turnstile -> { enabled, siteKey } for the browser widget.
// POST /api/turnstile { token } -> verifies with Cloudflare, sets the 30-minute pass cookie.
export async function GET() {
  return NextResponse.json({ enabled: turnstileEnabled(), siteKey: turnstileEnabled() ? process.env.TURNSTILE_SITE_KEY : null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!turnstileEnabled()) return NextResponse.json({ ok: true, enabled: false });
  const ip = requestIp(request);
  const limited = await requireRateLimit({ action: 'turnstile:ip:15m', key: ip, limit: 60, windowSeconds: 900 });
  if (limited) return limited;
  const body = await request.json().catch(() => ({}));
  if (!await verifyTurnstileToken(body?.token, ip)) return NextResponse.json({ error: 'The security check failed. Please try again.' }, { status: 403 });
  return humanPassCookie(NextResponse.json({ ok: true }));
}
