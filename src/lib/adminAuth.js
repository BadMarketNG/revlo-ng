import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-me';
const COOKIE = 'revlo_admin';
const TTL_MS = 60 * 60 * 1000;

// Revlo administrator sessions can only be minted after the BadMarket
// administrator panel has verified the person, their Revlo permission and MFA.
export function makeAdminSession(identity) {
  const body = {
    admin: true,
    source: 'badmarket-admin',
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    role: identity.role,
    exp: Date.now() + TTL_MS,
  };
  const json = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
  return `${json}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [json, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  let body;
  try {
    body = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  return body.admin === true && body.source === 'badmarket-admin' && body.sub && body.exp && Date.now() < body.exp ? body : null;
}

export function getAdminSession() {
  const token = cookies().get(COOKIE)?.value;
  return verifyAdminToken(token);
}

// True if the current request carries a valid panel-issued session cookie.
export function isAdminRequest() {
  return Boolean(getAdminSession());
}

export const ADMIN_COOKIE = COOKIE;
export const ADMIN_TTL_MS = TTL_MS;
