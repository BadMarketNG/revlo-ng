import crypto from 'crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requiredSecret } from '@/lib/security';

const COOKIE = 'revlo_admin';
const TTL_MS = 60 * 60 * 1000;

// Revlo administrator sessions can only be minted after the BadMarket
// administrator panel has verified the person, their Revlo permission and MFA.
export function makeAdminSession(identity) {
  const secret = requiredSecret('TOKEN_SECRET');
  const body = {
    admin: true,
    source: 'badmarket-admin',
    sub: identity.sub,
    email: identity.email,
    name: identity.name,
    role: identity.role,
    iat: Date.now(),
    exp: Date.now() + TTL_MS,
  };
  const json = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(json).digest('hex');
  return `${json}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [json, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', requiredSecret('TOKEN_SECRET')).update(json).digest('hex');
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

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  const session = verifyAdminToken(token);
  if (!session?.iat) return null;
  const { data } = await supabaseAdmin
    .from('revlo_admin_session_revocations')
    .select('revoked_after')
    .eq('administrator_id', session.sub)
    .maybeSingle();
  if (data?.revoked_after && new Date(data.revoked_after).getTime() >= session.iat) return null;
  return session;
}

// True if the current request carries a valid panel-issued session cookie.
export async function isAdminRequest() {
  return Boolean(await getAdminSession());
}

export const ADMIN_COOKIE = COOKIE;
export const ADMIN_TTL_MS = TTL_MS;
