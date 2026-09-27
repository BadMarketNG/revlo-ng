import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Each emailed publish link may create exactly one post. Only a hash of the
// token is stored.
function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function isPublishTokenUsed(token) {
  const { data, error } = await supabaseAdmin
    .from('revlo_used_publish_tokens')
    .select('token_hash')
    .eq('token_hash', tokenHash(token))
    .maybeSingle();
  if (error) throw new Error('publish link check unavailable');
  return !!data;
}

// Atomically claims the link. Returns { ok: true } for the first caller,
// { used: true } if the link was already used, or { error } on failure.
export async function claimPublishToken(token, expiresAtMs) {
  const { error } = await supabaseAdmin.from('revlo_used_publish_tokens').insert({
    token_hash: tokenHash(token),
    expires_at: new Date(expiresAtMs).toISOString(),
  });
  if (!error) return { ok: true };
  if (error.code === '23505') return { used: true };
  console.error('[publish-token:claim]', error.code || error.message);
  return { error: true };
}

// Frees a claim when the post could not be created, so the link can be retried.
export async function releasePublishToken(token) {
  await supabaseAdmin.from('revlo_used_publish_tokens').delete().eq('token_hash', tokenHash(token));
}

export async function recordPublishTokenPost(token, postUid) {
  await supabaseAdmin
    .from('revlo_used_publish_tokens')
    .update({ post_uid: postUid })
    .eq('token_hash', tokenHash(token));
}
