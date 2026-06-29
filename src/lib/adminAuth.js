import crypto from 'crypto';
import { cookies } from 'next/headers';

const SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-me';
const COOKIE = 'revlo_admin';
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Create a signed admin session token.
export function makeAdminSession() {
  const body = { admin: true, exp: Date.now() + TTL_MS };
  const json = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
  return `${json}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [json, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
  if (sig.length !== expected.length) return false;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  let body;
  try {
    body = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  return body.admin === true && body.exp && Date.now() < body.exp;
}

// True if the current request carries a valid admin session cookie.
export function isAdminRequest() {
  const token = cookies().get(COOKIE)?.value;
  return verifyAdminToken(token);
}

// Constant-time check of username + password.
export function checkCredentials(user, password) {
  const expectedUser = process.env.ADMIN_USER || '';
  const expectedPass = process.env.ADMIN_PASSWORD || '';
  if (!expectedUser || !expectedPass) return false;
  const okUser = safeEqual(String(user), expectedUser);
  const okPass = safeEqual(String(password), expectedPass);
  // Evaluate both regardless to avoid early-exit timing leaks.
  return okUser && okPass;
}

function safeEqual(input, expected) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const ADMIN_COOKIE = COOKIE;
export const ADMIN_TTL_MS = TTL_MS;
