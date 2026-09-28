import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { publicOrigin } from '@/lib/publicOrigin';

export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const APP_URL = publicOrigin();
  const staticEntries = [
    { url: `${APP_URL}/`, changeFrequency: 'always', priority: 1 },
    ...['rules', 'privacy', 'terms'].map((page) => ({ url: `${APP_URL}/${page}`, changeFrequency: 'monthly', priority: 0.3 })),
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
