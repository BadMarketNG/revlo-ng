import { supabaseAdmin } from '@/lib/supabaseAdmin';

const APP_URL = process.env.APP_URL || 'https://revlo.ng';

async function getPost(uid) {
  const { data } = await supabaseAdmin
    .from('posts')
    .select('uid,title,description,location,category,header_url,thumb_url,created_at')
    .eq('uid', uid)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }) {
  const post = await getPost(params.uid);
  if (!post) {
    return {
      title: 'Post not found — Revlo.ng',
      description: 'This post has expired or does not exist on Revlo.ng.',
    };
  }
  const description = (post.description || '').slice(0, 200);
  const image = post.header_url || post.thumb_url || undefined;
  return {
    title: `${post.title} — Revlo.ng`,
    description,
    alternates: { canonical: `${APP_URL}/p/${post.uid}` },
    openGraph: {
      title: post.title,
      description,
      url: `${APP_URL}/p/${post.uid}`,
      siteName: 'Revlo.ng',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: post.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PostPage({ params }) {
  const post = await getPost(params.uid);

  if (!post) {
    return (
      <div style={{ fontFamily: '-apple-system, sans-serif', maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: '#666' }}>This post has expired or doesn&apos;t exist.</p>
        <a href="/app.html" style={{ color: '#1B5E20', fontWeight: 700 }}>Go to Revlo.ng</a>
      </div>
    );
  }

  const link = `/app.html#post-${post.uid}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    headline: post.title,
    articleBody: post.description || undefined,
    datePublished: post.created_at,
    image: post.header_url || post.thumb_url || undefined,
    url: `${APP_URL}/p/${post.uid}`,
    contentLocation: post.location || undefined,
    publisher: { '@type': 'Organization', name: 'Revlo.ng', url: APP_URL },
  };

  return (
    <div style={{ fontFamily: '-apple-system, sans-serif', maxWidth: 600, margin: '0 auto', padding: '32px 20px' }}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {post.header_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.header_url} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 20, display: 'block' }} />
      )}
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>{post.title}</h1>
      <p style={{ color: '#666', marginBottom: 16 }}>{post.location}</p>
      {post.description && (
        <p style={{ lineHeight: 1.6, marginBottom: 24, color: '#333' }}>{post.description}</p>
      )}
      <a
        href={link}
        style={{ display: 'inline-block', background: '#1B5E20', color: '#fff', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}
      >
        View on Revlo.ng
      </a>
    </div>
  );
}
