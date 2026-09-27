import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { detectUploadType, requiredSecret, serializeJsonForHtml } from '@/lib/securityPrimitives.mjs';

export { detectUploadType, requiredSecret, serializeJsonForHtml };

export function constantTimeBearerMatches(header, secret) {
  const received = typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice(7)
    : '';
  if (!received || received.length !== secret.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(secret));
  } catch {
    return false;
  }
}

function rateKey(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export async function enforceRateLimit({ action, key, limit, windowSeconds }) {
  if (!key) return { allowed: false, unavailable: true };
  const { data, error } = await supabaseAdmin.rpc('consume_revlo_rate_limit', {
    p_action: action,
    p_key_hash: rateKey(key),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('[rate-limit]', error.code || error.message);
    return { allowed: false, unavailable: true };
  }
  return { allowed: data === true, unavailable: false };
}

export function rateLimitResponse(result) {
  const unavailable = result?.unavailable;
  return NextResponse.json(
    { error: unavailable ? 'This action is temporarily unavailable.' : 'Too many requests. Try again later.' },
    {
      status: unavailable ? 503 : 429,
      headers: {
        'Cache-Control': 'no-store',
        ...(unavailable ? {} : { 'Retry-After': '900' }),
      },
    },
  );
}

export async function requireRateLimit(input) {
  const result = await enforceRateLimit(input);
  return result.allowed ? null : rateLimitResponse(result);
}

function actionTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createPendingPublicAction({ action, postUid, email, message = null, sourceIp = null }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const { data, error } = await supabaseAdmin.from('revlo_pending_public_actions').insert({
    action,
    token_hash: actionTokenHash(token),
    post_uid: postUid,
    email,
    message,
    source_ip: sourceIp || null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }).select('id').single();
  if (error) throw new Error(`Could not create ${action} verification.`);
  return { id: data.id, token };
}

export async function discardPendingPublicAction(id) {
  if (id) await supabaseAdmin.from('revlo_pending_public_actions').delete().eq('id', id);
}

export async function consumePendingPublicAction(action, token) {
  if (!token || typeof token !== 'string' || token.length > 128) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('revlo_pending_public_actions')
    .update({ consumed_at: now })
    .eq('action', action)
    .eq('token_hash', actionTokenHash(token))
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('id,post_uid,email,message')
    .maybeSingle();
  if (error) {
    console.error('[public-action]', error.code || error.message);
    return null;
  }
  return data;
}
