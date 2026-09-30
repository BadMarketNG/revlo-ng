import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normaliseEmail } from '@/lib/revloBlocklist';

// Follow reasons and poster aliases (2026-09-30).

// Links, email addresses and phone numbers are not allowed in public notes or aliases.
const CONTACT_PATTERN = /(https?:|www\.|\b[a-z0-9-]+\.(com|ng|net|org|io|co)\b|@|\d[\d\s-]{6,}\d)/i;

// Returns { value } or { error }. An empty reason is allowed (it is optional).
export function cleanReason(input) {
  if (input == null) return { value: null };
  const value = String(input).replace(/\s+/g, ' ').trim();
  if (!value) return { value: null };
  if (value.length < 2) return { error: 'Write a little more, or leave the note empty.' };
  if (value.length > 200) return { error: 'Keep your note to 200 characters.' };
  if (CONTACT_PATTERN.test(value)) return { error: 'Please leave out links, emails and phone numbers.' };
  return { value };
}

// Public notes for the posters behind the given posts, newest first, plus each post's alias.
export async function reasonsForPosts(uids) {
  const { data: posts } = await supabaseAdmin.from('posts').select('uid,poster_email,poster_alias').in('uid', uids);
  const posterOf = new Map((posts || []).map((p) => [p.uid, normaliseEmail(p.poster_email)]));
  const aliasOf = new Map((posts || []).map((p) => [p.uid, p.poster_alias || null]));
  const posters = [...new Set(posterOf.values())];
  const byPoster = new Map(posters.map((p) => [p, []]));
  if (posters.length) {
    const { data: follows } = await supabaseAdmin.from('follows').select('poster_email,reason,created_at')
      .in('poster_email', posters).not('reason', 'is', null).eq('reason_hidden', false)
      .order('created_at', { ascending: false }).limit(2000);
    for (const row of follows || []) {
      const list = byPoster.get(normaliseEmail(row.poster_email));
      if (list) list.push({ text: row.reason, at: row.created_at });
    }
  }
  const result = {};
  for (const [uid, poster] of posterOf) {
    const list = byPoster.get(poster) || [];
    result[uid] = { alias: aliasOf.get(uid), count: list.length, reasons: list.slice(0, 50) };
  }
  return result;
}

const RESERVED = /(revlo|admin|support|moderator|official|staff|team|verified|police|efcc|government)/i;

// Returns { value } or { error }; '' or null means "remove my alias".
export function cleanAlias(input) {
  const value = String(input ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return { value: null };
  if (value.length < 2 || value.length > 24) return { error: 'Your alias must be 2 to 24 characters.' };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u.test(value)) return { error: 'Use letters, numbers, spaces, dots, dashes or apostrophes in your alias.' };
  if (CONTACT_PATTERN.test(value)) return { error: 'Your alias cannot contain a link, email or phone number.' };
  if (RESERVED.test(value)) return { error: 'That alias is reserved. Please choose another.' };
  return { value };
}

export async function aliasTakenByOther(alias, email) {
  const { data } = await supabaseAdmin.from('revlo_publisher_stats').select('email').ilike('alias', alias.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1);
  const owner = data?.[0]?.email;
  return Boolean(owner) && normaliseEmail(owner) !== normaliseEmail(email);
}

export async function currentAlias(email) {
  const { data } = await supabaseAdmin.from('revlo_publisher_stats').select('alias').eq('email', normaliseEmail(email)).maybeSingle();
  return data?.alias || null;
}

// Saves the alias and copies it onto all the publisher's live posts.
export async function saveAlias(email, alias) {
  const cleanEmail = normaliseEmail(email);
  const { error } = await supabaseAdmin.from('revlo_publisher_stats')
    .upsert({ email: cleanEmail, alias, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  if (error) return { error: error.code === '23505' ? 'taken' : 'failed' };
  await supabaseAdmin.from('posts').update({ poster_alias: alias }).eq('poster_email', cleanEmail).is('deleted_at', null);
  return { ok: true };
}
