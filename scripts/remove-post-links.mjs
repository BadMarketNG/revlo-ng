// One-off cleanup for post copy published before outbound links were blocked.
// Run with `node --env-file=.env.local scripts/remove-post-links.mjs` to preview,
// then add `--apply` to save the listed changes.
import { createClient } from '@supabase/supabase-js';
import { postWithoutLinks } from '../src/lib/postLinks.mjs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const apply = process.argv.includes('--apply');
let scanned = 0;
let changed = 0;

for (let offset = 0; ; offset += 500) {
  const { data: posts, error } = await db.from('posts')
    .select('uid,title,description,location')
    .order('uid')
    .range(offset, offset + 499);
  if (error) throw error;
  for (const post of posts || []) {
    scanned++;
    const cleaned = postWithoutLinks(post);
    const update = Object.fromEntries(['title', 'description', 'location']
      .filter(field => cleaned[field] !== post[field])
      .map(field => [field, cleaned[field]]));
    if (!Object.keys(update).length) continue;
    changed++;
    console.log(`${apply ? 'Cleaning' : 'Would clean'} ${post.uid}: ${Object.keys(update).join(', ')}`);
    if (apply) {
      const { error: updateError } = await db.from('posts').update(update).eq('uid', post.uid);
      if (updateError) throw updateError;
    }
  }
  if ((posts || []).length < 500) break;
}
console.log(`${scanned} posts checked; ${changed} ${apply ? 'cleaned' : 'need cleaning'}.`);
