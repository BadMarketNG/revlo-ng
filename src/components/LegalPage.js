// Shared shell for the Rules, Privacy and Terms pages: brand header, page
// switcher, numbered sections and the site footer.

export const CONTACT_EMAIL = 'support@revlo.ng';
export const LAST_UPDATED = '28 September 2026';

const G = '#1B5E20';
const INK = '#141414';
const MUTE = '#687068';
const LINE = '#e5e8e3';

const PAGES = [
  ['rules', 'Rules', '/rules'],
  ['privacy', 'Privacy', '/privacy'],
  ['terms', 'Terms of Use', '/terms'],
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ borderTop: `1px solid ${LINE}`, background: '#fff', padding: '28px 20px 36px', fontFamily: 'inherit' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '10px 22px', alignItems: 'center', justifyContent: 'space-between' }}>
        <nav aria-label="Legal" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
          <a href="/app.html" style={{ color: MUTE, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Home</a>
          {PAGES.map(([key, label, href]) => (
            <a key={key} href={href} style={{ color: MUTE, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>{label}</a>
          ))}
        </nav>
        <p style={{ margin: 0, color: MUTE, fontSize: 13 }}>© {year} Revlo.ng. All rights reserved.</p>
      </div>
    </footer>
  );
}

function Block({ block }) {
  if (typeof block === 'string') return <p style={{ margin: '0 0 12px', lineHeight: 1.65, color: '#333' }}>{block}</p>;
  return (
    <ul style={{ margin: '0 0 14px', paddingLeft: 20, lineHeight: 1.65, color: '#333' }}>
      {block.map((item) => <li key={item} style={{ marginBottom: 6 }}>{item}</li>)}
    </ul>
  );
}

export default function LegalPage({ active, eyebrow, title, intro, sections }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f7f8f6', color: INK, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <header style={{ background: '#fff', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px 20px 0' }}>
          <a href="/app.html" style={{ color: G, fontWeight: 900, fontSize: 20, textDecoration: 'none', letterSpacing: '-0.02em' }}>Revlo.ng</a>
          <nav aria-label="Policies" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 0 12px' }}>
            {PAGES.map(([key, label, href]) => {
              const on = key === active;
              return (
                <a key={key} href={href} aria-current={on ? 'page' : undefined} style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 99, border: on ? `1.5px solid ${G}` : '1.5px solid #e3e3e3', background: on ? G : '#fff', color: on ? '#fff' : '#555', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>{label}</a>
              );
            })}
          </nav>
        </div>
      </header>
      <main style={{ flex: 1, width: '100%', maxWidth: 760, margin: '0 auto', padding: '28px 20px 48px', boxSizing: 'border-box' }}>
        <p style={{ margin: 0, color: MUTE, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{eyebrow}</p>
        <h1 style={{ margin: '6px 0 8px', fontSize: 'clamp(28px, 6vw, 38px)', lineHeight: 1.08, letterSpacing: '-0.03em', color: G }}>{title}</h1>
        <p style={{ margin: '0 0 6px', color: MUTE, fontSize: 13 }}>Last updated {LAST_UPDATED}</p>
        <p style={{ margin: '14px 0 26px', fontSize: 16, lineHeight: 1.6, color: '#333' }}>{intro}</p>
        {sections.map(([heading, ...blocks], index) => (
          <section key={heading} id={`s${index + 1}`} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: '20px 20px 8px', marginBottom: 14 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, color: INK }}>
              <span style={{ color: G, marginRight: 8 }}>{String(index + 1).padStart(2, '0')}</span>{heading}
            </h2>
            {blocks.map((block, i) => <Block key={i} block={block} />)}
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
