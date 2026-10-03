'use client';
// Admin: scam contact reports (2026-10-03). Reports appear here after the reporter confirms their email.
// Confirm = counts in the public check and blocks the reported email for 90 days. Dismiss = ignored.
import { useCallback, useEffect, useState } from 'react';

const GREEN = '#16803d', RED = '#dc2626', BORDER = '#d9e1ea', MUTED = '#667085', TEXT = '#172033';

export default function ScamReports() {
  const [status, setStatus] = useState('pending');
  const [reports, setReports] = useState(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setReports(null);
    const r = await fetch(`/api/admin/scam-reports?status=${status}`, { cache: 'no-store' });
    const body = await r.json().catch(() => ({}));
    setReports(body.reports || []);
  }, [status]);
  useEffect(() => { const frame = requestAnimationFrame(() => { load(); }); return () => cancelAnimationFrame(frame); }, [load]);
  const act = async (id, action) => {
    const r = await fetch('/api/admin/scam-reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
    setMessage(r.ok ? (action === 'confirm' ? 'Confirmed. The reported email is blocked for 90 days.' : 'Dismissed.') : 'That did not work. Try again.');
    load();
  };
  return (
    <div style={{ color: TEXT }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['pending', 'To review'], ['confirmed', 'Confirmed'], ['dismissed', 'Dismissed']].map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${status === k ? GREEN : BORDER}`, background: status === k ? 'rgba(34,197,94,.12)' : 'transparent', color: status === k ? GREEN : MUTED, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
        ))}
      </div>
      {message && <p style={{ color: GREEN, fontWeight: 700 }}>{message}</p>}
      {!reports ? <p style={{ color: MUTED }}>Loading…</p> : reports.length === 0 ? <p style={{ color: MUTED }}>Nothing here.</p> : reports.map((r) => (
        <div key={r.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 12, background: '#fff' }}>
          <div style={{ fontWeight: 800 }}>{r.scam_type} · {r.contact_method}</div>
          <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>
            {r.subject_email && <div>Email: <strong>{r.subject_email}</strong></div>}
            {r.subject_phone && <div>Phone: <strong>{r.subject_phone}</strong></div>}
            {r.subject_handle && <div>Account: <strong>{r.subject_handle}</strong></div>}
            {r.post_uid && <div>Revlo post: <a href={`/p/${r.post_uid}`} target="_blank" rel="noreferrer">{r.post_uid}</a></div>}
            {r.money_lost ? <div>Money lost: {r.money_lost} {r.currency || ''}</div> : null}
            <div style={{ color: MUTED }}>Reported by {r.reporter_email} · {new Date(r.created_at).toLocaleString()} · {r.previousConfirmed} earlier confirmed report(s)</div>
          </div>
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, margin: '10px 0' }}>{r.details}</p>
          {r.evidence?.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {r.evidence.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  {/* Signed, short-lived links to private screenshots; next/image cannot optimise them. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Screenshot" style={{ height: 120, borderRadius: 8, border: `1px solid ${BORDER}` }} />
                </a>
              ))}
            </div>
          )}
          {r.status !== 'confirmed' && <button onClick={() => act(r.id, 'confirm')} style={{ marginTop: 10, marginRight: 8, padding: '8px 14px', borderRadius: 8, border: 0, background: GREEN, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Confirm and block email</button>}
          {r.status !== 'dismissed' && <button onClick={() => act(r.id, 'dismiss')} style={{ marginTop: 10, padding: '8px 14px', borderRadius: 8, border: `1px solid ${RED}`, background: '#fff', color: RED, fontWeight: 800, cursor: 'pointer' }}>Dismiss</button>}
        </div>
      ))}
    </div>
  );
}
