import { NextResponse } from 'next/server';
import { checkCredentials, makeAdminSession, ADMIN_COOKIE, ADMIN_TTL_MS } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { username, password } = body || {};
  if (!checkCredentials(username, password)) {
    // Small delay to slow brute-force attempts.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'incorrect username or password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeAdminSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(ADMIN_TTL_MS / 1000),
  });
  return res;
}
