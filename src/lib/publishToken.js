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

// ── Badge publish links (2026-09-29) ─────────────────────────────────────────
// Silver, Bronze and Gold publishers receive a link that creates several posts
// and has no time limit (see supabase/migrations/20260929000003). The functions
// above still handle the normal one-post, 30-minute link unchanged.

export function publishTokenHash(token) {
  return tokenHash(token);
}

// Claims one post from a badge link. Returns { ok, useId, remaining } or
// { ok: false, reason: 'inactive' | 'used_up' } or { error: true }.
export async function claimBadgeLinkUse(token, limit) {
  const { data, error } = await supabaseAdmin.rpc('claim_revlo_publish_link_use', {
    p_token_hash: tokenHash(token),
    p_limit: limit,
  });
  if (error) {
    console.error('[publish-link:claim]', error.code || error.message);
    return { error: true };
  }
  return { ok: data?.ok === true, useId: data?.use_id ?? null, remaining: data?.remaining ?? 0, reason: data?.reason ?? null };
}

export async function releaseBadgeLinkUse(useId) {
  if (useId) await supabaseAdmin.from('revlo_publish_link_uses').delete().eq('id', useId);
}

export async function recordBadgeLinkPost(useId, postUid) {
  if (useId) await supabaseAdmin.from('revlo_publish_link_uses').update({ post_uid: postUid }).eq('id', useId);
}

// Posts left on a badge link, or null when the link was replaced or revoked.
export async function badgeLinkRemaining(token, limit) {
  const hash = tokenHash(token);
  const [{ data: link, error: linkError }, { count, error: countError }] = await Promise.all([
    supabaseAdmin.from('revlo_magic_link_events').select('expires_at').eq('token_hash', hash).maybeSingle(),
    supabaseAdmin.from('revlo_publish_link_uses').select('id', { count: 'exact', head: true }).eq('token_hash', hash),
  ]);
  if (linkError || countError) throw new Error('publish link check unavailable');
  if (!link || new Date(link.expires_at) <= new Date()) return null;
  return Math.max(0, limit - (count || 0));
}
