import { NextResponse } from 'next/server';
import { signToken, verifyToken } from '@/lib/util';

// Cloudflare Turnstile (2026-09-30). The browser solves the Turnstile check
// once; /api/turnstile verifies it with Cloudflare and sets a signed,
// httpOnly "human" cookie for 30 minutes. Follow, contact, report, publish-link
// and posts-available requests then require that cookie. Until
// TURNSTILE_SECRET_KEY is configured the check is skipped, so deploying
// before the keys exist changes nothing.
export const HUMAN_COOKIE = 'revlo_human';
const HUMAN_TTL_MS = 30 * 60 * 1000;

export const turnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY);

export async function verifyTurnstileToken(token, ip) {
  if (!token || typeof token !== 'string' || token.length > 2048) return false;
  const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY || '', response: token });
  if (ip) form.set('remoteip', ip);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, cache: 'no-store' });
    const result = await response.json();
    return result?.success === true;
  } catch {
    return false;
  }
}

export function humanPassCookie(response) {
  response.cookies.set(HUMAN_COOKIE, signToken({ action: 'human' }, HUMAN_TTL_MS), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: HUMAN_TTL_MS / 1000,
  });
  return response;
}

// Returns a 403 response when the request has not passed Turnstile, else null.
export function requireHuman(request) {
  if (!turnstileEnabled()) return null;
  const claim = verifyToken(request.cookies?.get?.(HUMAN_COOKIE)?.value || '');
  if (claim?.action === 'human') return null;
  return NextResponse.json({ error: 'Please complete the security check and try again.', turnstile: true }, { status: 403 });
}
