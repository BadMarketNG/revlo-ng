import crypto from 'crypto';

const DESTINATIONS = ['stats', 'reports', 'posts', 'emails', 'bm', 'features', 'email-blocks', 'ip-blocks'];

function sharedSecret() {
  const secret = process.env.REVLO_ADMIN_SSO_SECRET || '';
  if (secret.length < 32) throw new Error('REVLO_ADMIN_SSO_SECRET is not configured.');
  return secret;
}

export function verifyAdminHandoff(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = crypto.createHmac('sha256', sharedSecret()).update(payload).digest('base64url');
  try {
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'badmarket-admin' || claims.aud !== 'revlo-admin') return null;
  if (!claims.sub || !claims.email || !claims.jti || !DESTINATIONS.includes(claims.destination)) return null;
  if (!claims.iat || claims.iat > now + 15 || !claims.exp || claims.exp < now || claims.exp > now + 90) return null;
  return claims;
}

export function serviceSecretMatches(header) {
  const received = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  const expected = sharedSecret();
  if (!received || received.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected)); } catch { return false; }
}
