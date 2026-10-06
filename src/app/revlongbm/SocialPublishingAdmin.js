'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

const GREEN = '#16803d';
const BORDER = '#d9e1ea';
const MUTED = '#667085';
const card = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 22 };
const button = (primary = false) => ({ border: `1px solid ${GREEN}`, borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', background: primary ? GREEN : '#fff', color: primary ? '#fff' : GREEN });

function timeLabel(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function SocialPublishingAdmin() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/social-publishing', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Could not load settings.');
    setData(body);
    setDraft(body.settings);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load().catch(error => setMessage(error.message)); }, [load]);
  const selected = useMemo(() => new Set(draft?.categories || []), [draft]);
  if (!data || !draft) return <section style={card}><p style={{ color: MUTED }}>{message || 'Loading social publishing controls…'}</p></section>;

  const toggleCategory = slug => setDraft(current => ({ ...current, categories: selected.has(slug) ? current.categories.filter(value => value !== slug) : [...current.categories, slug] }));
  const save = async () => {
    setBusy(true); setMessage('');
    const response = await fetch('/api/admin/social-publishing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(body.error || 'Could not save settings.');
    setDraft(body.settings); setData(current => ({ ...current, settings: body.settings })); setMessage('Social publishing settings saved.');
  };
  const run = async () => {
    setBusy(true); setMessage('');
    const response = await fetch('/api/admin/social-publishing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'run' }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(body.error || 'Could not run publishing.');
    const statuses = Object.entries(body.results || {}).map(([platform, result]) => `${platform}: ${result.ok ? 'sent' : result.error || 'failed'}`).join(' · ');
    setMessage(statuses || Object.values(body.status || {}).join(' · ') || 'Nothing new to publish.');
    await load();
  };

  return <section style={card}>
    <h2 style={{ margin: 0 }}>Social publishing</h2>
    <p style={{ color: MUTED, marginTop: 6 }}>Choose which Revlo posts are announced on Revlo’s own X and Facebook pages. This is separate from the inbound X Feed importer.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, margin: '20px 0' }}>
      {[['xEnabled', 'X', data.configured.x, draft.lastXAt], ['facebookEnabled', 'Facebook', data.configured.facebook, draft.lastFacebookAt]].map(([key, label, configured, last]) => <label key={key} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 15, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={draft[key]} onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))} style={{ marginTop: 3 }} />
        <span><strong>{label}</strong><br/><small style={{ color: configured ? GREEN : '#b45309' }}>{configured ? 'Connected' : 'Credentials not connected'}</small><br/><small style={{ color: MUTED }}>Last sent: {timeLabel(last)}</small></span>
      </label>)}
    </div>
    <h3>Categories to share</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>{data.categories.map(category => <label key={category.slug} style={{ border: `1px solid ${selected.has(category.slug) ? GREEN : BORDER}`, background: selected.has(category.slug) ? '#eef8f0' : '#fff', borderRadius: 999, padding: '8px 12px', cursor: 'pointer' }}><input type="checkbox" checked={selected.has(category.slug)} onChange={() => toggleCategory(category.slug)} style={{ marginRight: 7 }}/>{category.label}</label>)}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginTop: 22 }}>
      <label><strong>Posting interval</strong><br/><select value={draft.intervalHours} onChange={event => setDraft(current => ({ ...current, intervalHours: Number(event.target.value) }))} style={{ width: '100%', padding: 11, marginTop: 7, border: `1px solid ${BORDER}`, borderRadius: 8 }}>{data.intervals.map(hours => <option key={hours} value={hours}>{hours < 24 ? `Every ${hours} hour${hours === 1 ? '' : 's'}` : hours === 24 ? 'Once a day' : `Every ${hours / 24} days`}</option>)}</select></label>
      <label><strong>Default hashtags</strong><br/><input value={Array.isArray(draft.hashtags) ? draft.hashtags.join(' ') : draft.hashtags || ''} onChange={event => setDraft(current => ({ ...current, hashtags: event.target.value }))} placeholder="#RevloNG #LagosJobs" style={{ width: '100%', boxSizing: 'border-box', padding: 11, marginTop: 7, border: `1px solid ${BORDER}`, borderRadius: 8 }}/><small style={{ color: MUTED }}>Optional. Up to 8; spaces or commas are accepted.</small></label>
    </div>
    {message && <p style={{ color: message.includes('saved') || message.includes('sent') ? GREEN : '#b45309', fontWeight: 700 }}>{message}</p>}
    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}><button disabled={busy} onClick={save} style={button(true)}>{busy ? 'Working…' : 'Save controls'}</button><button disabled={busy} onClick={run} style={button(false)}>Run now</button></div>
  </section>;
}
