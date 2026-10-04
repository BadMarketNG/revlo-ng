import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { postWithoutLinks } from '@/lib/postLinks.mjs';
import { serializeJsonForHtml } from '@/lib/security';
import { publicOrigin } from '@/lib/publicOrigin';
import { jobPostingFor, nigerianAddress } from '@/lib/jobPosting.mjs';
import { eventFor, productFor } from '@/lib/listingMarkup.mjs';

const APP_URL = publicOrigin();

async function getPost(uid) {
  const { data } = await supabaseAdmin
    .from('posts')
    // ORIGINAL (commented out 2026-10-02): .select('uid,title,description,location,category,header_url,thumb_url,created_at')
    // NOTE: expires_at and poster_alias added for the Google for Jobs markup (validThrough, employer).
    .select('uid,title,description,location,category,post_type,budget_max,needed_by,header_url,thumb_url,created_at,expires_at,poster_alias')
    .eq('uid', uid)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return postWithoutLinks(data);
}

// NOTE (2026-10-02): the employer for Google for Jobs: the imported job's employer, else the
// publisher's public alias. Job posts with neither keep the ordinary markup.
// NOTE (2026-10-02): Rentals / For Sale posts that take bookings link to the booking sheet.
async function takesBookings(post) {
  if (post.post_type === 'wanted') return false;
  if (post.category !== 'rentals' && post.category !== 'for_sale' && post.category !== 'vehicles') return false;
  if (post.category === 'rentals' || post.category === 'vehicles') return true;
  const { data } = await supabaseAdmin.from('revlo_booking_settings').select('post_uid').eq('post_uid', post.uid).maybeSingle();
  return Boolean(data);
}

async function getEmployer(post) {
  if (post.post_type === 'wanted') return null;
  if (post.category !== 'jobs') return null;
  const { data } = await supabaseAdmin.from('revlo_imported_jobs').select('company').eq('post_uid', post.uid).maybeSingle();
  return data?.company || post.poster_alias || null;
}

export async function generateMetadata({ params }) {
  const { uid } = await params;
  const post = await getPost(uid);
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
  const { uid } = await params;
  const post = await getPost(uid);

  if (!post) {
    return (
      <div style={{ fontFamily: '-apple-system, sans-serif', maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: '#666' }}>This post has expired or doesn&apos;t exist.</p>
        <a href="/app.html" style={{ color: '#1B5E20', fontWeight: 700 }}>Go to Revlo.ng</a>
      </div>
    );
  }

  const link = `/app.html#post-${post.uid}`;
  const employer = await getEmployer(post);
  const bookable = await takesBookings(post);
  // NOTE (2026-10-02): job posts with an employer use JobPosting markup (Google for Jobs).
  const jobPosting = post.post_type === 'wanted' ? null : jobPostingFor(post, { employer, origin: APP_URL });
  // NOTE (2026-10-02): For Sale posts with a price use Product markup; Promotions with an event date use Event markup.
  const listingMarkup = post.post_type === 'wanted' ? null : productFor(post, { origin: APP_URL })
    || eventFor(post, { origin: APP_URL, organizer: post.poster_alias, address: nigerianAddress(post.location) });
  const socialPosting = {
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
        // ORIGINAL (commented out 2026-10-02): dangerouslySetInnerHTML={{ __html: serializeJsonForHtml(jsonLd) }}
        dangerouslySetInnerHTML={{ __html: serializeJsonForHtml(jobPosting || listingMarkup || socialPosting) }}
      />
      {post.header_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.header_url} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 20, display: 'block' }} />
      )}
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>{post.title}</h1>
      {post.post_type === 'wanted' && <strong style={{ display: 'inline-block', padding: '6px 11px', borderRadius: 99, background: '#f8b83f', color: '#392400' }}>WANTED</strong>}
      {/* ORIGINAL (2026-10-02): <p style={{ color: '#666', marginBottom: 16 }}>{post.location}</p> */}
      {/* NOTE: job posts also show the employer and how to apply, which Google needs visible on the page. */}
      <p style={{ color: '#666', marginBottom: 16 }}>{[jobPosting ? employer : null, post.location].filter(Boolean).join(' · ')}</p>
      {post.post_type === 'wanted' && <p style={{ color: '#355842', marginBottom: 16 }}>
        {post.budget_max ? `Maximum budget: ₦${Number(post.budget_max).toLocaleString('en-NG')}` : 'Budget open'}
        {post.needed_by ? ` · Needed by ${new Date(post.needed_by).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
      </p>}
      {post.description && (
        // ORIGINAL (2026-10-02): <p style={{ lineHeight: 1.6, marginBottom: 24, color: '#333' }}>{post.description}</p>
        // NOTE: keeps line breaks, so the "Price:", "When:" and "Where:" lines read as lines.
        <p style={{ lineHeight: 1.6, marginBottom: 24, color: '#333', whiteSpace: 'pre-line' }}>{post.description}</p>
      )}
      <a
        href={link}
        style={{ display: 'inline-block', background: '#1B5E20', color: '#fff', padding: '12px 24px', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}
      >
        {/* ORIGINAL (2026-10-02): View on Revlo.ng */}
        {jobPosting ? 'Apply: contact on Revlo.ng' : 'View on Revlo.ng'}
      </a>
      {bookable && (
        <a href={`/app.html?book=${encodeURIComponent(post.uid)}`} style={{ display: 'inline-block', marginLeft: 10, border: '1.5px solid #b45309', color: '#92400e', background: '#fff7e6', padding: '11px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>
          📅 Book a viewing or call
        </a>
      )}
      {jobPosting && (
        <p style={{ color: '#666', fontSize: 14, marginTop: 14 }}>
          To apply, open this post on Revlo.ng and use Contact. Posted {new Date(post.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      )}
    </div>
  );
}
