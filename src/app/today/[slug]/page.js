import { notFound } from 'next/navigation';
import Image from 'next/image';
import { socialCardFromSlug } from '@/lib/socialPost.mjs';

const COPY = {
  jobs: { title: 'Looking for work?', detail: 'See the jobs posted on Revlo today.' },
  rentals: { title: 'Looking for a place?', detail: 'Browse rooms and rentals while they are live.' },
  for_sale: { title: 'Looking for a deal?', detail: 'See what people are selling today.' },
};

export async function generateMetadata({ params }) {
  const card = socialCardFromSlug((await params).slug);
  if (!card) return { title: 'Revlo.ng' };
  const copy = COPY[card.category];
  const image = `https://revlo.ng${card.image}`;
  return {
    title: `${copy.title} · Revlo.ng`,
    description: copy.detail,
    robots: { index: false, follow: true },
    openGraph: { type: 'website', title: copy.title, description: copy.detail, url: `https://revlo.ng/today/${(await params).slug}`, images: [{ url: image, width: 1600, height: 900, alt: `Illustrative stock photo for ${card.category.replace('_', ' ')}` }] },
    twitter: { card: 'summary_large_image', title: copy.title, description: copy.detail, images: [image] },
  };
}

export default async function TodayPage({ params }) {
  const card = socialCardFromSlug((await params).slug);
  if (!card) notFound();
  const copy = COPY[card.category];
  return <main style={{ minHeight: '100vh', background: '#e8eddf', color: '#173e2c', fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
    <div style={{ maxWidth: 1050, margin: '32px auto', background: '#fffdf6', borderRadius: 18, overflow: 'hidden', boxShadow: '0 12px 36px #14382120' }}>
      <Image src={card.image} alt="Illustrative stock photo" width={1600} height={900} priority style={{ width: '100%', height: 'auto', maxHeight: 460, objectFit: 'cover', display: 'block' }} />
      <div style={{ padding: 'clamp(20px, 5vw, 44px)' }}>
        <p style={{ margin: '0 0 12px', fontWeight: 750 }}>revlo.ng · {card.date}</p>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 58px)', lineHeight: 1.05, margin: '0 0 16px' }}>{copy.title}</h1>
        <p style={{ fontSize: 20, lineHeight: 1.5, margin: '0 0 26px' }}>{copy.detail} Posts expire automatically, so availability can change.</p>
        <a href="/app.html?utm_source=social&amp;utm_medium=daily" style={{ display: 'inline-block', background: '#1b5e20', color: 'white', textDecoration: 'none', padding: '14px 22px', borderRadius: 9, fontWeight: 750 }}>Browse live posts</a>
        <p style={{ fontSize: 13, color: '#607064', marginTop: 20 }}>Photo is illustrative stock imagery, not a specific listing.</p>
      </div>
    </div>
  </main>;
}
