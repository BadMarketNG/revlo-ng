import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function beginMagicLinkAudit({ token, email, expiresAt }) {
  const { data, error } = await supabaseAdmin.rpc('reserve_revlo_magic_link', {
    p_token_hash: tokenHash(token),
    p_email: email,
    p_expires_at: expiresAt,
  });
  if (error) {
    console.error('[magic-link:audit:start]', error.code || error.message);
    throw new Error('magic link audit unavailable');
  }
  return data === true;
}

export async function hasActiveMagicLink(email) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('revlo_magic_link_events')
    .select('id,delivery_status,requested_at')
    .eq('email', email)
    .is('redeemed_at', null)
    .gt('expires_at', now)
    .in('delivery_status', ['pending', 'sent'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[magic-link:audit:active]', error.code || error.message);
    throw new Error('magic link audit unavailable');
  }
  return Boolean(data);
}

export async function finishMagicLinkDelivery(token, result) {
  const delivered = result?.ok === true;
  const { error } = await supabaseAdmin
    .from('revlo_magic_link_events')
    .update({
      delivery_status: delivered ? 'sent' : 'failed',
      delivery_id: delivered ? result.id || null : null,
      sent_at: delivered ? new Date().toISOString() : null,
    })
    .eq('token_hash', tokenHash(token));
  if (error) console.error('[magic-link:audit:delivery]', error.code || error.message);
}

export async function markMagicLinkOpened(token) {
  const { error } = await supabaseAdmin
    .from('revlo_magic_link_events')
    .update({ opened_at: new Date().toISOString() })
    .eq('token_hash', tokenHash(token))
    .is('opened_at', null);
  if (error) console.error('[magic-link:audit:opened]', error.code || error.message);
}

export async function markMagicLinkRedeemed(token, postUid) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('revlo_magic_link_events')
    .update({ opened_at: now, redeemed_at: now, post_uid: postUid })
    .eq('token_hash', tokenHash(token));
  if (error) console.error('[magic-link:audit:redeemed]', error.code || error.message);
}
