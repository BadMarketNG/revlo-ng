'use client';
// Admin: support enquiries (2026-10-03). Contact messages on imported jobs and X posts (posted by
// support@revlo.ng). Open the original listing, find the employer's own application page or email, and
// send it to the applicant. Links to where the job was found are refused.
import { useCallback, useEffect, useState } from 'react';

const GREEN = '#16803d', RED = '#dc2626', BORDER = '#d9e1ea', MUTED = '#667085', TEXT = '#172033', AMBER = '#b45309';
const input = { padding: '8px 10px', border: `1px solid ${BORDER}`, borderRadius: 8, font: 'inherit', width: '100%', boxSizing: 'border-box' };

function Reply({ enquiry, onSent }) {
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true); setError('');
    const r = await fetch('/api/admin/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: enquiry.id, apply_link: link, message: note }) });
    const body = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(body.error || 'That did not work. Try again.'); return; }
    onSent(`Sent to ${enquiry.from_email}.`);
  };
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 10, fontSize: 13.5 }}>
      <label>Employer&apos;s application page or email<input style={input} value={link} onChange={e => setLink(e.target.value)} placeholder="https://careers.employer.com/… or hr@employer.com" /></label>
      <label>Message (optional)<textarea style={{ ...input, minHeight: 60 }} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. The closing date is Friday. Mention Revlo when you apply." /></label>
      {error && <p style={{ color: RED, fontWeight: 700, margin: 0 }}>{error}</p>}
      <div><button disabled={busy || !link.trim()} onClick={send} style={{ padding: '8px 14px', borderRadius: 8, border: 0, background: GREEN, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: busy || !link.trim() ? 0.6 : 1 }}>{busy ? 'Sending…' : 'Send to applicant'}</button></div>
    </div>
  );
}

export default function SupportEnquiries() {
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setItems(null);
    const r = await fetch(`/api/admin/enquiries?status=${status}`, { cache: 'no-store' });
    const body = await r.json().catch(() => ({}));
    setItems(body.enquiries || []);
  }, [status]);
  useEffect(() => { const frame = requestAnimationFrame(() => { load(); }); return () => cancelAnimationFrame(frame); }, [load]);

  return (
    <div style={{ color: TEXT, maxWidth: 900 }}>
      <p style={{ color: MUTED, marginTop: 0 }}>Messages about imported jobs and X posts. Open the original listing, find the employer&apos;s own application page or email, and send that. Never send the original listing link: it shows where the job was found.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['open', 'To answer'], ['replied', 'Answered']].map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${status === k ? GREEN : BORDER}`, background: status === k ? 'rgba(34,197,94,.12)' : 'transparent', color: status === k ? GREEN : MUTED, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>
      {message && <p style={{ color: GREEN, fontWeight: 700 }}>{message}</p>}
      {!items ? <p style={{ color: MUTED }}>Loading…</p> : items.length === 0 ? <p style={{ color: MUTED }}>Nothing here.</p> : items.map(e => (
        <div key={e.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <strong>{e.post_title || e.post_uid}</strong>
            <span style={{ color: MUTED, fontSize: 13 }}>{new Date(e.created_at).toLocaleString()}</span>
          </div>
          <div style={{ fontSize: 13.5, marginTop: 6, lineHeight: 1.6 }}>
            <div>From: <strong>{e.from_email}</strong> · Post: <a href={`/p/${e.post_uid}`} target="_blank" rel="noreferrer">{e.post_uid}</a></div>
            {e.original
              ? <div><a href={e.original.url} target="_blank" rel="noopener noreferrer" style={{ color: AMBER, fontWeight: 700 }}>{e.original.kind === 'x' ? 'Original X post ↗' : 'Original listing ↗'}</a> <span style={{ color: MUTED }}>(internal)</span></div>
              : <div style={{ color: MUTED }}>No original listing recorded.</div>}
            <blockquote style={{ margin: '8px 0 0', padding: '8px 12px', borderLeft: `3px solid ${BORDER}`, background: '#f8fafc', whiteSpace: 'pre-wrap' }}>{e.message}</blockquote>
            {e.replied_at && <div style={{ color: GREEN, marginTop: 6 }}>Answered {new Date(e.replied_at).toLocaleString()} with {e.reply_link}</div>}
          </div>
          {!e.replied_at && <Reply enquiry={e} onSent={(text) => { setMessage(text); load(); }} />}
          <div style={{ marginTop: 8, fontSize: 13 }}><a href={`mailto:${e.from_email}?subject=${encodeURIComponent(`About "${e.post_title || ''}" on Revlo.ng`)}`} style={{ color: MUTED }}>Or reply by email yourself</a></div>
        </div>
      ))}
    </div>
  );
}
