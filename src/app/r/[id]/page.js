// Results (2026-10-02): a shareable page for one real result, e.g. "Let in 3 hours".
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { headline } from '@/lib/outcomes.mjs';

async function getResult(id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabaseAdmin.from('revlo_outcomes').select('id,outcome,label,hours,share,resolved_at').eq('id', id).maybeSingle();
  return data?.share ? data : null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const r = await getResult(id);
  if (!r) return { title: 'Revlo.ng', robots: { index: false } };
  const title = `${headline(r.outcome, Number(r.hours))}: ${r.label} — Revlo.ng`;
  const image = `https://revlo.ng/api/outcomes/card?id=${r.id}`;
  return {
    title,
    description: 'A real result on Revlo.ng. Post jobs, rentals, items for sale and promotions free, with no sign-up.',
    openGraph: { title, url: `https://revlo.ng/r/${r.id}`, siteName: 'Revlo.ng', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, images: [image] },
  };
}

export default async function ResultPage({ params }) {
  const { id } = await params;
  const r = await getResult(id);
  if (!r) {
    return (
      <div style={{ fontFamily: '-apple-system, sans-serif', maxWidth: 600, margin: '0 auto', padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: '#666' }}>This result is not available.</p>
        <a href="/app.html" style={{ color: '#1B5E20', fontWeight: 700 }}>Go to Revlo.ng</a>
      </div>
    );
  }
  return (
    <div style={{ fontFamily: '-apple-system, sans-serif', maxWidth: 640, margin: '0 auto', padding: '32px 20px' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/outcomes/card?id=${r.id}`} alt={`${headline(r.outcome, Number(r.hours))}: ${r.label}`} style={{ width: '100%', borderRadius: 14, display: 'block' }} />
      <h1 style={{ fontSize: 26, margin: '22px 0 6px', color: '#1B5E20' }}>{headline(r.outcome, Number(r.hours))}</h1>
      <p style={{ color: '#555', margin: '0 0 22px' }}>{r.label}. A real result on Revlo.ng.</p>
      <a href="/app.html" style={{ display: 'inline-block', background: '#1B5E20', color: '#fff', padding: '13px 22px', borderRadius: 10, textDecoration: 'none', fontWeight: 800 }}>Post yours free, no sign-up</a>
    </div>
  );
}
