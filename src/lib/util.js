import crypto from 'crypto';

// Generate a Revlo post id: RV-XXXXXX (6 uppercase alphanumerics)
export function makeUid() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `RV-${s}`;
}

// Map a duration choice to an expiry timestamp from now.
const DURATION_MS = {
  now: 24 * 60 * 60 * 1000, // RIGHT NOW = 24 hours
  '1m': 30 * 24 * 60 * 60 * 1000, // 1 month = 30 days
  '2m': 60 * 24 * 60 * 60 * 1000, // 2 months = 60 days
  '3m': 90 * 24 * 60 * 60 * 1000, // 3 months = 90 days
};

export function expiryFor(duration) {
  const ms = DURATION_MS[duration];
  if (!ms) return null;
  return new Date(Date.now() + ms).toISOString();
}

export function isValidDuration(d) {
  return Object.prototype.hasOwnProperty.call(DURATION_MS, d);
}

export const CATEGORIES = ['jobs', 'rentals', 'for_sale', 'promotions', 'general'];

export function isValidCategory(c) {
  return CATEGORIES.includes(c);
}

// Very light email sanity check.
export function isEmail(s) {
  return typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
}

// Create a tamper-proof, expiring token (used for delete & magic links).
// Format: base64url(payloadJSON).hmacHex
const SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-me';

export function signToken(payload, ttlMs = 30 * 60 * 1000) {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const json = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
  return `${json}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [json, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(json).digest('hex');
  // constant-time compare
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  let body;
  try {
    body = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!body.exp || Date.now() > body.exp) return null;
  return body;
}
