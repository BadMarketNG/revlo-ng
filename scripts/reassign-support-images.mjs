import { pickSupportStock } from '../src/lib/supportStock.mjs';

const apply = process.argv.includes('--apply');
const base = new URL(`${process.env.SUPABASE_URL}/rest/v1/posts`);
base.searchParams.set('select', 'uid,title,category,header_url');
base.searchParams.set('poster_email', 'eq.support@revlo.ng');
base.searchParams.set('deleted_at', 'is.null');
base.searchParams.set('expires_at', `gt.${new Date().toISOString()}`);
base.searchParams.set('order', 'created_at.desc');
base.searchParams.set('limit', '1000');
const headers = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
};
const response = await fetch(base, { headers });
if (!response.ok) throw new Error(`Could not fetch posts (${response.status})`);
const posts = await response.json();
const stock = url => typeof url === 'string' && url.startsWith('https://revlo.ng/samples/headers/');
// Hold every current header while planning so an update never takes a photo
// still shown by another post. The first post on each stock image keeps it;
// later duplicates move to unused photos.
const used = new Set(posts.map(post => post.header_url).filter(Boolean));
const retained = new Set();
const changes = [];
for (const post of posts.filter(post => stock(post.header_url))) {
  if (!retained.has(post.header_url)) { retained.add(post.header_url); continue; }
  const header = pickSupportStock(post.category, post.title, used);
  if (!header) throw new Error(`No unused stock photo for ${post.uid} (${post.category})`);
  used.add(header);
  if (header !== post.header_url) changes.push({ uid: post.uid, category: post.category, old: post.header_url, header });
}
console.log(`${posts.length} live support posts, ${changes.length} image changes, ${used.size} distinct images planned`);
if (!apply) {
  for (const change of changes) console.log(`${change.uid} ${change.category}: ${change.old.split('/').pop()} → ${change.header.split('/').pop()}`);
  process.exit(0);
}
for (const change of changes) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/posts`);
  url.searchParams.set('uid', `eq.${change.uid}`);
  const result = await fetch(url, { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ header_url: change.header }) });
  if (!result.ok) throw new Error(`${change.uid}: failed to save photo (${result.status})`);
}
console.log(`Updated ${changes.length} live support posts`);
