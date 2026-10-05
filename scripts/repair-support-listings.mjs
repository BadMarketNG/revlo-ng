import { pickSupportStock } from '../src/lib/supportStock.mjs';

// One-time repair of live support listings that had an unrelated fallback photo.
// The three non-listing X posts are expired, not deleted, so the history remains.
const PHOTO_REPAIR = new Set(['RV-PRUNWS', 'RV-YL2EAV', 'RV-5ZK4SL', 'RV-BN9XEQ', 'RV-BN9B52']);
const NOT_LISTINGS = new Set(['RV-8X9QS2', 'RV-G5YWFK', 'RV-749SZT']);
const apply = process.argv.includes('--apply');
const endpoint = new URL(`${process.env.SUPABASE_URL}/rest/v1/posts`);
endpoint.searchParams.set('select', 'uid,title,description,category,poster_email,header_url');
endpoint.searchParams.set('poster_email', 'eq.support@revlo.ng');
endpoint.searchParams.set('deleted_at', 'is.null');
endpoint.searchParams.set('expires_at', `gt.${new Date().toISOString()}`);
endpoint.searchParams.set('limit', '1000');
const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const response = await fetch(endpoint, { headers });
if (!response.ok) throw new Error(`Could not fetch posts (${response.status})`);
const posts = await response.json();
const used = new Set(posts.map(post => post.header_url).filter(Boolean));
const changes = [];
for (const post of posts) {
  if (PHOTO_REPAIR.has(post.uid)) {
    const header_url = pickSupportStock(post.category, `${post.title} ${post.description}`, used);
    if (!header_url) throw new Error(`No suitable unused photo for ${post.uid}`);
    used.add(header_url);
    changes.push({ uid: post.uid, patch: { header_url }, old: post.header_url });
  }
  if (NOT_LISTINGS.has(post.uid)) changes.push({ uid: post.uid, patch: { expires_at: new Date().toISOString() } });
}
for (const change of changes) console.log(`${change.uid}: ${change.old?.split('/').pop() || 'not a listing'} → ${change.patch.header_url?.split('/').pop() || 'expired'}`);
if (!apply) process.exit(0);
for (const change of changes) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/posts`);
  url.searchParams.set('uid', `eq.${change.uid}`);
  const result = await fetch(url, { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(change.patch) });
  if (!result.ok) throw new Error(`${change.uid}: failed to save (${result.status})`);
}
console.log(`Repaired ${changes.length} support posts`);
