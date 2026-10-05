// Original listings: where a support@revlo.ng post came from.
// Internal only: shown in the admin and in enquiry emails to support@revlo.ng, never on the site.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { hostOf } from '@/lib/sourceGuard.mjs';

export const SUPPORT_POSTER = 'support@revlo.ng';

/** Map of post uid -> { kind, url, host } for the given uids. */
export async function originalListings(uids) {
  const list = [...new Set((uids || []).filter(Boolean))];
  if (!list.length) return {};
  const [{ data: jobs }, { data: xPosts }, { data: publicPages }] = await Promise.all([
    supabaseAdmin.from('revlo_imported_jobs').select('post_uid,listing_url').in('post_uid', list),
    supabaseAdmin.from('revlo_x_posts').select('post_uid,id,author_username').in('post_uid', list),
    supabaseAdmin.from('revlo_discovery_imports').select('post_uid,source,source_url').in('post_uid', list),
  ]);
  const out = {};
  for (const j of jobs || []) out[j.post_uid] = { kind: 'job', url: j.listing_url, host: hostOf(j.listing_url) };
  for (const x of xPosts || []) out[x.post_uid] = { kind: 'x', url: `https://x.com/${encodeURIComponent(x.author_username)}/status/${encodeURIComponent(x.id)}`, host: 'x.com' };
  for (const page of publicPages || []) out[page.post_uid] = { kind: page.source, url: page.source_url, host: hostOf(page.source_url) };
  return out;
}

export { hostOf, revealsSource } from '@/lib/sourceGuard.mjs';
