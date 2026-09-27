import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function beginMagicLinkAudit({ token, email, expiresAt }) {
  const { error } = await supabaseAdmin.from('revlo_magic_link_events').insert({
    token_hash: tokenHash(token),
    email,
    expires_at: expiresAt,
  });
  if (error) {
    console.error('[magic-link:audit:start]', error.code || error.message);
    throw new Error('magic link audit unavailable');
  }
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
