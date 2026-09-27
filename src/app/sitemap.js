import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.APP_URL || 'https://revlo.ng';

export default async function sitemap() {
  const staticEntries = [
    { url: `${APP_URL}/`, changeFrequency: 'always', priority: 1 },
  ];

  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('uid, created_at')
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1000);

  const postEntries = (posts || []).map((p) => ({
    url: `${APP_URL}/p/${p.uid}`,
    lastModified: p.created_at,
    changeFrequency: 'hourly',
    priority: 0.7,
  }));

  return [...staticEntries, ...postEntries];
}
