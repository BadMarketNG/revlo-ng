import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { ADMIN_COOKIE, ADMIN_TTL_MS, makeAdminSession } from '@/lib/adminAuth';
import { verifyAdminHandoff } from '@/lib/adminSso';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  let claims;
  try { claims = verifyAdminHandoff(request.nextUrl.searchParams.get('token')); } catch { claims = null; }
  if (!claims) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const nonceHash = crypto.createHash('sha256').update(claims.jti).digest('hex');
  const { error } = await supabaseAdmin.from('admin_sso_nonces').insert({
    nonce_hash: nonceHash,
    administrator_id: claims.sub,
    administrator_email: claims.email,
    expires_at: new Date(claims.exp * 1000).toISOString(),
  });
  if (error) return NextResponse.json({ error: 'This administrator handoff is unavailable or has already been used.' }, { status: 403 });

  const destination = claims.destination;
  const target = new URL(`/revlongbm?tab=${encodeURIComponent(destination)}`, request.url);
  const response = NextResponse.redirect(target, 303);
  response.cookies.set(ADMIN_COOKIE, makeAdminSession(claims), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(ADMIN_TTL_MS / 1000),
  });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
