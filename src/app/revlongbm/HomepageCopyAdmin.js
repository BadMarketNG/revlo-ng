'use client';
import { useEffect, useState } from 'react';

const GREEN = '#16803d';
const BORDER = '#d9e1ea';
const MUTED = '#667085';
const card = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22 };
const field = { width: '100%', boxSizing: 'border-box', padding: 11, marginTop: 7, border: `1px solid ${BORDER}`, borderRadius: 8 };

export default function HomepageCopyAdmin() {
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/admin/homepage-copy', { cache: 'no-store' }).then(r => r.json().then(body => ({ ok: r.ok, body }))).then(({ ok, body }) => { if (!ok) throw new Error(body.error); setDraft(body.settings); }).catch(error => setMessage(error.message || 'Could not load homepage copy.')); }, []);
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const setPrompt = (index, value) => setDraft(current => ({ ...current, urgentPrompts: current.urgentPrompts.map((prompt, promptIndex) => promptIndex === index ? value : prompt) }));
  const save = async () => {
    setBusy(true); setMessage('');
    const response = await fetch('/api/admin/homepage-copy', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(body.error || 'Could not save homepage copy.');
    setDraft(body.settings); setMessage('Homepage copy saved.');
  };
  if (!draft) return <section style={card}><p style={{ color: MUTED }}>{message || 'Loading homepage editor…'}</p></section>;
  const input = (label, key, max = 90) => <label><strong>{label}</strong><input value={draft[key]} maxLength={max} onChange={event => set(key, event.target.value)} style={field}/></label>;
  return <div style={{ display: 'grid', gap: 18 }}>
    <section style={card}><h2 style={{ marginTop: 0 }}>Homepage copy</h2><p style={{ color: MUTED }}>Edit the words visitors see. The public layout, colors, type sizes, spacing, icons and button styles stay fixed.</p></section>
    <section style={card}><h3 style={{ marginTop: 0 }}>Main introduction</h3><div style={{ display: 'grid', gap: 14 }}>{input('Headline — first line', 'heroLine1')}{input('Headline — second line', 'heroLine2')}<label><strong>Introduction</strong><textarea value={draft.heroDescription} maxLength={320} rows={4} onChange={event => set('heroDescription', event.target.value)} style={{ ...field, resize: 'vertical' }}/></label></div></section>
    <section style={card}><h3 style={{ marginTop: 0 }}>24-hour listing prompt</h3><p style={{ color: MUTED }}>These four questions rotate in the same banner.</p><div style={{ display: 'grid', gap: 12 }}>{draft.urgentPrompts.map((prompt, index) => <label key={index}><strong>Rotating line {index + 1}</strong><input value={prompt} maxLength={70} onChange={event => setPrompt(index, event.target.value)} style={field}/></label>)}{input('Button label', 'urgentButton', 45)}</div></section>
    <section style={card}><h3 style={{ marginTop: 0 }}>Benefit badges</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>{input('No-sign-up badge', 'benefitNoSignup', 45)}{input('Enquiries badge', 'benefitEnquiries', 45)}{input('Viewings badge', 'benefitViewings', 45)}{input('Expiry badge', 'benefitExpiry', 45)}</div></section>
    {message && <p style={{ color: message.includes('saved') ? GREEN : '#b45309', fontWeight: 700 }}>{message}</p>}
    <div><button disabled={busy} onClick={save} style={{ border: 0, borderRadius: 8, padding: '11px 18px', fontWeight: 700, cursor: 'pointer', background: GREEN, color: '#fff' }}>{busy ? 'Saving…' : 'Save homepage copy'}</button></div>
  </div>;
}
