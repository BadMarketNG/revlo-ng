// Bump up (2026-10-02). Price comes from REVLO_BUMP_PRICE_NAIRA (default ₦500); a bump lasts 24 hours.
export const BUMP_HOURS = 24;
export const bumpPriceKobo = () => Math.max(10000, Math.round(Number(process.env.REVLO_BUMP_PRICE_NAIRA || 500) * 100));
export const naira = kobo => `₦${(kobo / 100).toLocaleString('en-NG')}`;

/** Live bumps (post uids bumped within the last 24 hours), newest first. */
export async function liveBumps(db, now = Date.now()) {
  const { data } = await db.from('revlo_bumps').select('post_uid,bumped_at').gt('bumped_at', new Date(now - BUMP_HOURS * 3600000).toISOString()).order('bumped_at', { ascending: false }).limit(200);
  return [...new Set((data ?? []).map(b => b.post_uid))];
}

/** Moves bumped posts to the front of an already-ordered list, newest bump first. */
export function pinBumped(posts, bumpedUids) {
  if (!bumpedUids.length) return posts;
  const rank = new Map(bumpedUids.map((uid, i) => [uid, i]));
  const pinned = posts.filter(p => rank.has(p.uid)).sort((a, b) => rank.get(a.uid) - rank.get(b.uid));
  return [...pinned, ...posts.filter(p => !rank.has(p.uid))];
}

/** Applies a paid bump once (idempotent by payment reference). */
export async function applyBump(db, { reference, postUid }) {
  const { data: post } = await db.from('posts').select('uid,created_at').eq('uid', postUid).is('deleted_at', null).maybeSingle();
  if (!post) return false;
  const { error } = await db.from('revlo_bumps').insert({ post_uid: postUid, reference, original_created_at: post.created_at });
  if (error) return error.code === '23505'; // already applied for this payment
  await db.from('posts').update({ created_at: new Date().toISOString() }).eq('uid', postUid);
  return true;
}
