'use client';
// Admin: X feed (2026-10-03). Searches (what Revlo pulls from X and which category it posts into) and the
// budget (posts per period, period length, monthly dollar cap, price per post), plus "Run now".
// Empty budget fields fall back to the Vercel environment values.
import { useCallback, useEffect, useState } from 'react';

const GREEN = '#16803d', RED = '#dc2626', BORDER = '#d9e1ea', MUTED = '#667085', TEXT = '#172033';
const input = { padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, font: 'inherit', width: '100%', boxSizing: 'border-box' };
const button = (bg = GREEN) => ({ padding: '8px 14px', borderRadius: 8, border: 0, background: bg, color: '#fff', fontWeight: 700, cursor: 'pointer' });
const blank = { name: '', category: 'jobs', terms: '', match_words: '', cities: 'Lagos, Abuja, Port Harcourt', national: false, enabled: true, position: 100 };

export default function XFeedAdmin() {
  const [data, setData] = useState(null);
  const [budget, setBudget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/x-feed', { cache: 'no-store' });
    const body = await r.json().catch(() => null);
    if (!r.ok || !body) { setMessage('Could not load the X feed settings.'); return; }
    setData(body);
    const s = body.settings;
    setBudget({ enabled: s.enabled, period_posts: s.periodPosts, period_days: s.periodDays, monthly_usd: s.monthlyUsd, price_per_post: s.pricePerPost });
  }, []);
  useEffect(() => { const frame = requestAnimationFrame(() => { load(); }); return () => cancelAnimationFrame(frame); }, [load]);

  const call = async (method, payload, ok) => {
    const r = await fetch('/api/admin/x-feed', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await r.json().catch(() => ({}));
    setMessage(r.ok ? ok(body) : (body.error || 'That did not work. Try again.'));
    if (r.ok) load();
    return r.ok;
  };
  const saveBudget = () => call('PUT', budget, () => 'Budget saved. It applies from the next run.');
  const saveSearch = async () => { if (await call('POST', { ...editing, cities: String(editing.cities).split(',') }, () => 'Search saved.')) setEditing(null); };
  const toggle = s => call('POST', { ...s, enabled: !s.enabled }, () => (s.enabled ? `"${s.name}" switched off.` : `"${s.name}" switched on.`));
  const remove = s => { if (window.confirm(`Delete the search "${s.name}"?`)) call('DELETE', { id: s.id }, () => 'Search deleted.'); };
  const runNow = async () => {
    setRunning(true);
    await call('POST', { action: 'run' }, b => (b.skipped ? `Not read from X: ${b.skipped}. Published ${b.published || 0} saved post(s).` : `Read ${b.read} post(s) from X, kept ${b.stored}, published ${b.published} as Revlo posts${b.stopped ? ` (stopped: ${b.stopped})` : ''}.`));
    setRunning(false);
  };

  if (!data || !budget) return <p style={{ color: MUTED }}>{message || 'Loading…'}</p>;
  const { usage, settings, searches, categories } = data;
  const label = slug => categories.find(c => c.slug === slug)?.label || slug;
  const periodPct = Math.min(100, Math.round((usage.periodRead / settings.periodPosts) * 100));
  const monthCapPosts = Math.floor(settings.monthlyUsd / settings.pricePerPost);

  return (
    <div style={{ color: TEXT, maxWidth: 980 }}>
      {message && <p style={{ color: /not|could|error|must|give|choose|add at/i.test(message) ? RED : GREEN, fontWeight: 700 }}>{message}</p>}

      <section style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, background: '#fff', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 10px' }}>Spending</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, fontSize: 14 }}>
          <div><div style={{ color: MUTED }}>This period (since {usage.periodFrom})</div><strong style={{ fontSize: 20 }}>{usage.periodRead} / {settings.periodPosts} posts</strong><div style={{ color: MUTED }}>about ${usage.periodSpend}</div>
            <div style={{ height: 6, background: '#eef2f6', borderRadius: 6, marginTop: 6 }}><div style={{ width: `${periodPct}%`, height: 6, borderRadius: 6, background: periodPct >= 100 ? RED : GREEN }} /></div></div>
          <div><div style={{ color: MUTED }}>This month</div><strong style={{ fontSize: 20 }}>{usage.monthRead} posts</strong><div style={{ color: MUTED }}>about ${usage.monthSpend} of ${settings.monthlyUsd} ({monthCapPosts} posts)</div></div>
          <div><div style={{ color: MUTED }}>Today</div><strong style={{ fontSize: 20 }}>{usage.todayRead} posts</strong><div style={{ color: MUTED }}>{usage.todayRequests} request(s) to X</div></div>
        </div>
        <p style={{ color: MUTED, fontSize: 12.5, margin: '10px 0 0' }}>Spend is estimated from posts read × price per post. Check X&apos;s developer console for the exact bill.</p>
      </section>

      <section style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, background: '#fff', marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 10px' }}>Budget</h3>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700, marginBottom: 12 }}>
          <input type="checkbox" checked={budget.enabled} onChange={e => setBudget({ ...budget, enabled: e.target.checked })} /> Read from X (switch off to stop all spending)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, fontSize: 13.5 }}>
          <label>Posts per period<input style={input} type="number" min="10" value={budget.period_posts} onChange={e => setBudget({ ...budget, period_posts: e.target.value })} /></label>
          <label>Period length (days)<input style={input} type="number" min="1" max="31" value={budget.period_days} onChange={e => setBudget({ ...budget, period_days: e.target.value })} /></label>
          <label>Monthly cap (US$)<input style={input} type="number" min="0" step="1" value={budget.monthly_usd} onChange={e => setBudget({ ...budget, monthly_usd: e.target.value })} /></label>
          <label>Price per post read (US$)<input style={input} type="number" min="0.0001" step="0.001" value={budget.price_per_post} onChange={e => setBudget({ ...budget, price_per_post: e.target.value })} /></label>
        </div>
        <p style={{ color: MUTED, fontSize: 12.5 }}>Reading stops at whichever is reached first: the period&apos;s posts or the monthly cap. Each run uses only its share of the period, so posts arrive throughout it. X runs every 6 hours.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={button()} onClick={saveBudget}>Save budget</button>
          <button style={button('#0f1419')} disabled={running} onClick={runNow}>{running ? 'Running…' : 'Run now'}</button>
        </div>
      </section>

      <section style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Searches</h3>
          <button style={button()} onClick={() => setEditing({ ...blank })}>+ Add search</button>
        </div>
        {searches.length === 0 && <p style={{ color: MUTED }}>No searches yet. Add one to start pulling posts from X.</p>}
        {searches.map(s => (
          <div key={s.id} style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 0', opacity: s.enabled ? 1 : 0.55 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div><strong>{s.name}</strong> <span style={{ color: MUTED }}>→ {label(s.category)} · {s.national ? 'national' : s.cities.join(', ')}{s.enabled ? '' : ' · off'}</span></div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={button('#475467')} onClick={() => setEditing({ ...s, cities: s.cities.join(', ') })}>Edit</button>
                <button style={button(s.enabled ? '#b45309' : GREEN)} onClick={() => toggle(s)}>{s.enabled ? 'Switch off' : 'Switch on'}</button>
                <button style={button(RED)} onClick={() => remove(s)}>Delete</button>
              </div>
            </div>
            <code style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 4, wordBreak: 'break-word' }}>{s.terms}</code>
          </div>
        ))}
        {editing && (
          <div style={{ marginTop: 14, padding: 14, border: `1px solid ${GREEN}`, borderRadius: 10, display: 'grid', gap: 10, fontSize: 13.5 }}>
            <strong>{editing.id ? `Edit "${editing.name}"` : 'New search'}</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
              <label>Name<input style={input} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Cars for sale" /></label>
              <label>Posts go into<select style={input} value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}>{categories.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select></label>
            </div>
            <label>X search words (X search syntax; OR between choices, quotes for phrases, from:account for one account)
              <textarea style={{ ...input, minHeight: 70 }} value={editing.terms} onChange={e => setEditing({ ...editing, terms: e.target.value })} placeholder={'("car for sale" OR "tokunbo" OR "foreign used") (toyota OR honda OR lexus)'} /></label>
            <label>Only publish posts containing one of these words (comma-separated; blank = publish everything found)
              <input style={input} value={editing.match_words} onChange={e => setEditing({ ...editing, match_words: e.target.value })} placeholder="for sale, selling, price, ₦" /></label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={editing.national} onChange={e => setEditing({ ...editing, national: e.target.checked })} /> National (one search for all of Nigeria, no city needed in the post)</label>
            {!editing.national && <label>Cities (comma-separated; each city is one search per run)<input style={input} value={editing.cities} onChange={e => setEditing({ ...editing, cities: e.target.value })} /></label>}
            <p style={{ color: MUTED, margin: 0, fontSize: 12.5 }}>Each city costs up to 10 posts per run, so more cities and searches share the same budget.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={button()} onClick={saveSearch}>Save search</button>
              <button style={button('#98a2b3')} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
