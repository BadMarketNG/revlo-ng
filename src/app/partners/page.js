import { SiteFooter } from '@/components/LegalPage';

export const metadata = { title: 'Verified partners | Revlo.ng', description: 'Organisations and services with a verified reciprocal link to Revlo.' };
export const dynamic = 'force-dynamic';

async function partners() {
  try {
    const response = await fetch('https://badmarket.ng/api/backlinks?site=revlo', { cache: 'no-store' });
    if (!response.ok) return [];
    return (await response.json()).partners || [];
  } catch { return []; }
}

export default async function PartnersPage() {
  const rows = await partners();
  return <div style={{ minHeight: '100vh', background: '#f7f8f6', color: '#141414', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
    <main style={{ maxWidth: 820, minHeight: '70vh', margin: '0 auto', padding: '56px 20px' }}>
      <a href="/app.html" style={{ color: '#1B5E20', fontWeight: 800, textDecoration: 'none' }}>← Revlo.ng</a>
      <h1 style={{ margin: '28px 0 8px', fontSize: 40, color: '#1B5E20' }}>Verified partners</h1>
      <p style={{ color: '#687068', marginBottom: 28 }}>Organisations and services with a verified reciprocal link to Revlo.</p>
      {!rows.length ? <p>No verified partners are listed yet.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>{rows.map(row => <a key={row.id} href={row.partnerUrl} rel={row.rel === 'follow' ? undefined : row.rel} style={{ display: 'block', padding: 20, border: '1px solid #dfe4dc', borderRadius: 16, background: '#fff', color: '#141414', textDecoration: 'none' }}><strong style={{ fontSize: 18 }}>{row.label}</strong>{row.description && <p style={{ color: '#687068', lineHeight: 1.5 }}>{row.description}</p>}<span style={{ color: '#1B5E20', fontWeight: 800 }}>Visit partner ↗</span></a>)}</div>}
    </main><SiteFooter />
  </div>;
}
