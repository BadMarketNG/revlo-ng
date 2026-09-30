import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Follower counts belong to the poster, so every live post by that poster shows
// the same up-to-date number (2026-09-29). Called after a follow is confirmed
// and after an unfollow.
export async function refreshPosterFollowerCounts(posterEmail) {
  const email = String(posterEmail || '').trim().toLowerCase();
  if (!email) return;
  const { count } = await supabaseAdmin.from('follows').select('*', { count: 'exact', head: true }).ilike('poster_email', escapeLike(email));
  await supabaseAdmin.from('posts').update({ followers: count || 0 }).ilike('poster_email', escapeLike(email)).is('deleted_at', null);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
