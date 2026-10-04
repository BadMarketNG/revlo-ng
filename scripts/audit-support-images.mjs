import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await db.from('posts').select('uid,title,category,header_url').eq('poster_email', 'support@revlo.ng').is('deleted_at', null).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
if (error) throw error;
const byImage = new Map();
for (const post of data || []) {
  const key = post.header_url || '(none)';
  const list = byImage.get(key) || [];
  list.push(`${post.uid} ${post.category} ${post.title.slice(0, 65)}`);
  byImage.set(key, list);
}
console.log(`${data?.length || 0} active support posts; ${byImage.size} distinct headers`);
for (const [image, posts] of byImage) if (posts.length > 1) console.log(`${image}\n  ${posts.join('\n  ')}`);
