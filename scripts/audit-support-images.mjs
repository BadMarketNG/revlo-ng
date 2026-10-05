const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/posts`);
url.searchParams.set('select', 'uid,title,description,category,header_url');
url.searchParams.set('poster_email', 'eq.support@revlo.ng');
url.searchParams.set('deleted_at', 'is.null');
url.searchParams.set('expires_at', `gt.${new Date().toISOString()}`);
url.searchParams.set('order', 'created_at.desc');
url.searchParams.set('limit', '1000');
const response = await fetch(url, { headers: {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
} });
if (!response.ok) throw new Error(`Could not fetch posts (${response.status})`);
const data = await response.json();
const byImage = new Map();
for (const post of data || []) {
  const key = post.header_url || '(none)';
  const list = byImage.get(key) || [];
  list.push(`${post.uid} ${post.category} ${post.title.slice(0, 65)}`);
  byImage.set(key, list);
}
console.log(`${data?.length || 0} active support posts; ${byImage.size} distinct headers`);
console.log('Categories:', Object.fromEntries([...new Set(data.map(post => post.category))].map(category => [category, data.filter(post => post.category === category).length])));
if (process.argv.includes('--all')) for (const post of data || []) console.log(`${post.uid} ${post.category} ${post.title.slice(0, 70)} → ${post.header_url?.split('/').pop() || '(none)'}${post.category === 'for_sale' ? ` · ${post.description?.slice(0, 140).replace(/\s+/g, ' ') || ''}` : ''}`);
for (const [image, posts] of byImage) if (posts.length > 1) console.log(`${image}\n  ${posts.join('\n  ')}`);
