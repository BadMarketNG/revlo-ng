// Original listings (2026-10-03): where a support@revlo.ng post came from (an imported job or an X post).
// Internal only: shown in the admin and in enquiry emails to support@revlo.ng, never on the site.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hostOf } from '@/lib/sourceGuard.mjs';

export const SUPPORT_POSTER = 'support@revlo.ng';

/** Map of post uid -> { kind: 'job' | 'x', url, host } for the given uids. */
export async function originalListings(uids) {
  const list = [...new Set((uids || []).filter(Boolean))];
  if (!list.length) return {};
  const [{ data: jobs }, { data: xPosts }] = await Promise.all([
    supabaseAdmin.from('revlo_imported_jobs').select('post_uid,listing_url').in('post_uid', list),
    supabaseAdmin.from('revlo_x_posts').select('post_uid,id,author_username').in('post_uid', list),
  ]);
  const out = {};
  for (const j of jobs || []) out[j.post_uid] = { kind: 'job', url: j.listing_url, host: hostOf(j.listing_url) };
  for (const x of xPosts || []) out[x.post_uid] = { kind: 'x', url: `https://x.com/${encodeURIComponent(x.author_username)}/status/${encodeURIComponent(x.id)}`, host: 'x.com' };
  return out;
}

export { hostOf, revealsSource } from '@/lib/sourceGuard.mjs';
