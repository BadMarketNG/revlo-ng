'use client';
import { useState, useEffect, useCallback } from 'react';

const GREEN = '#16803d';
const RED = '#dc2626';
const AMBER = '#b45309';
const BLUE = '#2563eb';
const BG = '#f5f7fa';
const CARD = '#ffffff';
const BORDER = '#d9e1ea';
const TEXT = '#172033';
const MUTED = '#667085';
const SUBTLE = '#475467';

const DUR_LABEL = { now: 'RIGHT NOW (24h)', '1m': '1 MONTH', '2m': '2 MONTHS', '3m': '3 MONTHS' };
const CAT_LABEL = { jobs: 'Jobs', rentals: 'Rentals', for_sale: 'For Sale', promotions: 'Promotions', general: 'General' };
const CAT_COLOR = { jobs: '#60a5fa', rentals: '#c084fc', for_sale: '#fb923c', promotions: '#f472b6', general: '#94a3b8' };

export default function AdminPage() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [tab, setTab] = useState('stats');
  const [activeCount, setActiveCount] = useState(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (['stats', 'reports', 'posts', 'emails', 'bm', 'email-blocks', 'ip-blocks'].includes(requested)) setTab(requested);
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.admin))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetch('/api/admin/stats').then((r) => r.json()).then((d) => setActiveCount(d.stats?.active ?? null)).catch(() => {});
  }, [authed, tab]);

  useEffect(() => {
    if (!authed) return;
    let active = true;
    const checkSession = () => fetch('/api/admin/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => { if (active && !data.admin) setAuthed(false); })
      .catch(() => {});
    const timer = setInterval(checkSession, 15_000);
    const onVisibility = () => { if (document.visibilityState === 'visible') checkSession(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkSession);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkSession);
    };
  }, [authed]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.replace('/app.html');
  };

  if (authed === null) {
    return <Shell><p style={{ color: MUTED }}>Checking…</p></Shell>;
  }

  if (!authed) {
    return (
      <Shell>
        <h1 style={{ color: GREEN, marginTop: 0, letterSpacing: '-0.5px' }}>revlo<span style={{ color: TEXT }}>.ng</span></h1>
        <p style={{ color: MUTED, fontSize: 13, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginTop: -8 }}>Admin Panel</p>
        <p style={{ color: MUTED, fontSize: 14 }}>This administrator session has ended.</p>
        <a href="/app.html" style={{ ...btn(GREEN), display: 'block', boxSizing: 'border-box', textAlign: 'center', textDecoration: 'none' }}>Return to Revlo</a>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ color: GREEN, margin: 0, letterSpacing: '-0.5px', fontSize: 28 }}>revlo<span style={{ color: TEXT }}>.ng</span></h1>
          <p style={{ color: MUTED, fontSize: 12, textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, margin: '2px 0 0' }}>Admin Panel</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {activeCount !== null && (
            <span style={{ background: 'rgba(34,197,94,0.12)', border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
              {activeCount} active on Revlo
            </span>
          )}
          <a href="/app.html" style={{ ...miniBtn('#1f2937'), color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>View Site</a>
          <button onClick={logout} style={{ ...miniBtn('transparent'), color: RED, border: `1px solid ${RED}` }}>Logout</button>
        </div>
      </div>
      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '24px 0' }}>
        {[['stats', 'Stats'], ['reports', 'Reports'], ['posts', 'All Posts'], ['emails', 'Emails'], ['bm', 'BadMarket'], ['email-blocks', 'Email Blocks'], ['ip-blocks', 'IP Blocks']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: `1px solid ${tab === k ? GREEN : BORDER}`,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              background: tab === k ? 'rgba(34,197,94,0.12)' : 'transparent',
              color: tab === k ? GREEN : MUTED,
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'stats' && <Stats />}
      {tab === 'reports' && <Reports />}
      {tab === 'posts' && <AllPosts />}
      {tab === 'emails' && <Emails />}
      {tab === 'bm' && <BMLinks />}
      {tab === 'email-blocks' && <BlockList blockType="email" />}
      {tab === 'ip-blocks' && <BlockList blockType="ip" />}
      <p style={{ marginTop: 40, fontSize: 12, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
        Admin view shows hidden emails and full controls. Public users never see these. · © 2026 Revlo.ng
      </p>
    </Shell>
  );
}

function Stats() {
  const [s, setS] = useState(null);
  useEffect(() => { fetch('/api/admin/stats').then((r) => r.json()).then((d) => setS(d.stats)); }, []);
  if (!s) return <p style={{ color: MUTED }}>Loading…</p>;
  const card = (label, val, color = GREEN) => (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 18, minWidth: 130 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{label}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {card('Active posts', s.active)}
        {card('Expired', s.expired, MUTED)}
        {card('Deleted', s.deleted, RED)}
        {card('Total views', s.totalViews.toLocaleString())}
        {card('Followers', s.follows, BLUE)}
        {card('Reports', s.reports, AMBER)}
        {card('BadMarket links', s.bmLinks, AMBER)}
      </div>
      <h3 style={{ marginTop: 28, color: TEXT, fontSize: 15, textTransform: 'uppercase', letterSpacing: '1px' }}>Active posts by duration</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.entries(s.byDuration).map(([k, v]) => card(DUR_LABEL[k], v))}
      </div>
      {s.byCategory && (
        <>
          <h3 style={{ marginTop: 28, color: TEXT, fontSize: 15, textTransform: 'uppercase', letterSpacing: '1px' }}>Active posts by category</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {Object.entries(s.byCategory).map(([k, v]) => card(CAT_LABEL[k] || k, v, CAT_COLOR[k] || GREEN))}
          </div>
        </>
      )}
    </div>
  );
}

function Reports() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => { fetch('/api/admin/reports').then((r) => r.json()).then((d) => setRows(d.reports || [])); }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (uid, action) => {
    await fetch('/api/admin/post-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, action }) });
    load();
  };
  if (!rows) return <p style={{ color: MUTED }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: MUTED }}>No reports. 🎉</p>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {rows.map((r) => (
        <div key={r.uid} style={{ ...cardStyle, opacity: r.deleted ? 0.55 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: TEXT }}>{r.title}</strong> <span style={{ color: MUTED, fontSize: 13 }}>{r.uid} · {r.location}</span>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 6 }}>Contact: {r.poster_email}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ background: 'rgba(251,191,36,0.12)', color: AMBER, borderRadius: 6, padding: '3px 8px', fontWeight: 700, fontSize: 13 }}>{r.count} report{r.count > 1 ? 's' : ''}</span>
                {Object.entries(r.reasons).map(([reason, c]) => (
                  <span key={reason} style={{ marginLeft: 8, fontSize: 13, color: MUTED }}>{reason}: {c}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {r.deleted
                ? <button onClick={() => act(r.uid, 'restore')} style={miniBtn(GREEN)}>Restore</button>
                : <button onClick={() => act(r.uid, 'soft_delete')} style={miniBtn(RED)}>Remove post</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AllPosts() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [editingUid, setEditingUid] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: 'general' });

  const load = useCallback(() => { fetch('/api/admin/posts?all=1').then((r) => r.json()).then((d) => setRows(d.posts || [])); }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (uid, action, extra) => {
    await fetch('/api/admin/post-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, action, ...extra }) });
    load();
  };

  const startEdit = (p) => {
    setEditingUid(p.uid);
    setEditForm({ title: p.title, description: p.description || '', category: p.category || 'general' });
  };
  const saveEdit = async (uid) => {
    await act(uid, 'edit', editForm);
    setEditingUid(null);
  };
  const hardDelete = async (uid) => {
    if (!confirm(`Permanently delete ${uid}? This cannot be undone.`)) return;
    await act(uid, 'hard_delete');
  };

  if (!rows) return <p style={{ color: MUTED }}>Loading…</p>;
  const ql = q.trim().toLowerCase();
  const filtered = rows.filter((p) =>
    (cat === 'all' || p.category === cat) &&
    (!ql || p.title.toLowerCase().includes(ql) || (p.poster_email || '').includes(ql) || p.uid.toLowerCase().includes(ql) || (p.location || '').toLowerCase().includes(ql))
  );

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, email, uid, location…" style={{ ...inp, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['all', 'jobs', 'rentals', 'for_sale', 'promotions', 'general'].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${cat === c ? (CAT_COLOR[c] || GREEN) : BORDER}`,
              background: cat === c ? `${CAT_COLOR[c] || GREEN}22` : 'transparent',
              color: cat === c ? (CAT_COLOR[c] || GREEN) : MUTED,
            }}
          >
            {c === 'all' ? 'All' : CAT_LABEL[c]}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map((p) => {
          const expired = new Date(p.expires_at) < new Date();
          const isEditing = editingUid === p.uid;
          return (
            <div key={p.uid} style={{ ...cardStyle, opacity: p.deleted_at ? 0.5 : 1 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                {(p.thumb_url || p.header_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumb_url || p.header_url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: `1px solid ${BORDER}` }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isEditing ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} style={inp} placeholder="Title" />
                      <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Description" />
                      <select value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} style={inp}>
                        {Object.entries(CAT_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => saveEdit(p.uid)} style={miniBtn(GREEN)}>Save</button>
                        <button onClick={() => setEditingUid(null)} style={miniBtn('#374151')}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <strong style={{ color: TEXT }}>{p.title}</strong>{' '}
                          <span style={{ color: MUTED, fontSize: 13 }}>{p.uid} · {p.location}</span>
                          {p.category && (
                            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: CAT_COLOR[p.category] || MUTED, background: `${CAT_COLOR[p.category] || MUTED}1a`, borderRadius: 6, padding: '2px 8px' }}>
                              {CAT_LABEL[p.category] || p.category}
                            </span>
                          )}
                          {p.deleted_at && <span style={{ marginLeft: 8, color: RED, fontSize: 12, fontWeight: 700 }}>DELETED</span>}
                          {!p.deleted_at && expired && <span style={{ marginLeft: 8, color: MUTED, fontSize: 12, fontWeight: 700 }}>EXPIRED</span>}
                          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Contact: {p.poster_email} · {p.views} views · {p.followers} followers</div>
                          {p.description && <div style={{ fontSize: 13, color: SUBTLE, marginTop: 6, maxWidth: 520 }}>{p.description}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select defaultValue={p.duration} onChange={(e) => act(p.uid, 'change_duration', { duration: e.target.value })} style={{ ...inp, width: 'auto', padding: '6px 8px' }}>
                            {Object.entries(DUR_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                          </select>
                          <button onClick={() => startEdit(p)} style={miniBtn(BLUE)}>Edit</button>
                          {p.deleted_at
                            ? <button onClick={() => act(p.uid, 'restore')} style={miniBtn(GREEN)}>Restore</button>
                            : <button onClick={() => act(p.uid, 'soft_delete')} style={miniBtn(RED)}>Delete</button>}
                          <button onClick={() => hardDelete(p.uid)} style={miniBtn('#7f1d1d')}>Hard delete</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ color: MUTED }}>No posts match.</p>}
      </div>
    </div>
  );
}

function Emails() {
  const [data, setData] = useState(null);
  const load = useCallback(() => { fetch('/api/admin/emails').then((r) => r.json()).then(setData); }, []);
  useEffect(() => { load(); }, [load]);
  const unsub = async (poster_email, follower_email) => {
    await fetch('/api/admin/emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poster_email, follower_email }) });
    load();
  };
  if (!data) return <p style={{ color: MUTED }}>Loading…</p>;
  return (
    <div>
      <h3 style={{ color: TEXT, fontSize: 15 }}>Poster emails ({data.posters.length})</h3>
      <div style={{ ...cardStyle, marginBottom: 24, fontSize: 14, columns: 2, color: SUBTLE }}>
        {data.posters.map((e) => <div key={e} style={{ padding: '2px 0' }}>{e}</div>)}
        {data.posters.length === 0 && <span style={{ color: MUTED }}>None yet.</span>}
      </div>
      <h3 style={{ color: TEXT, fontSize: 15 }}>Follow subscriptions ({data.follows.length})</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {data.follows.map((f, i) => (
          <div key={i} style={{ ...cardStyle, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 14 }}>
            <span style={{ color: SUBTLE }}><strong style={{ color: TEXT }}>{f.follower_email}</strong> follows <strong style={{ color: TEXT }}>{f.poster_email}</strong></span>
            <button onClick={() => unsub(f.poster_email, f.follower_email)} style={miniBtn(AMBER)}>Unsubscribe</button>
          </div>
        ))}
        {data.follows.length === 0 && <p style={{ color: MUTED }}>No subscriptions yet.</p>}
      </div>
    </div>
  );
}

function BMLinks() {
  const [rows, setRows] = useState(null);
  useEffect(() => { fetch('/api/admin/bm-links').then((r) => r.json()).then((d) => setRows(d.links || [])); }, []);
  if (!rows) return <p style={{ color: MUTED }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: MUTED }}>No BadMarket links yet.</p>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((l, i) => (
        <div key={i} style={{ ...cardStyle, padding: '10px 14px', fontSize: 14 }}>
          <strong style={{ color: TEXT }}>{l.title}</strong> <span style={{ color: MUTED }}>{l.uid}</span>
          <div style={{ color: SUBTLE, marginTop: 4 }}>Payout: {l.payout_email}</div>
        </div>
      ))}
    </div>
  );
}

function BlockList({ blockType }) {
  const [rows, setRows] = useState(null);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const label = blockType === 'email' ? 'email address' : 'IP address';

  const load = useCallback(() => {
    fetch('/api/admin/blocks')
      .then((r) => r.json())
      .then((data) => setRows((data.blocks || []).filter((row) => row.block_type === blockType)));
  }, [blockType]);
  useEffect(() => { load(); }, [load]);

  const add = async (event) => {
    event.preventDefault();
    setMessage('');
    const response = await fetch('/api/admin/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block_type: blockType, value, reason }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error || 'Could not add block.');
    setValue('');
    setReason('');
    setMessage('Block added.');
    load();
  };

  const remove = async (id) => {
    const response = await fetch(`/api/admin/blocks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) load();
  };

  const active = (row) => !row.expires_at || new Date(row.expires_at) > new Date();
  return (
    <div>
      <div style={{ ...cardStyle, marginBottom: 18 }}>
        <h2 style={{ color: TEXT, fontSize: 18, margin: '0 0 6px' }}>{blockType === 'email' ? 'Email Block List' : 'IP Block List'}</h2>
        <p style={{ color: MUTED, fontSize: 13, margin: '0 0 16px' }}>
          Revlo-only controls. Manual blocks remain until removed; automatic blocks show their trigger and expiry.
        </p>
        <form onSubmit={add} style={{ display: 'grid', gap: 10 }}>
          <input value={value} onChange={(event) => setValue(event.target.value)} style={inp} placeholder={`Enter ${label}`} required />
          <input value={reason} onChange={(event) => setReason(event.target.value)} style={inp} placeholder="Reason (optional)" />
          <button type="submit" style={{ ...miniBtn(GREEN), width: 'fit-content' }}>Add to block list</button>
          {message && <span style={{ color: message === 'Block added.' ? GREEN : RED, fontSize: 13 }}>{message}</span>}
        </form>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {(rows || []).map((row) => (
          <div key={row.id} style={{ ...cardStyle, opacity: active(row) ? 1 : 0.65, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: TEXT }}>{row.value}</strong>
              <div style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>{row.reason}</div>
              <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                {row.source === 'manual' ? 'Manual' : `Automatic · ${row.source.replaceAll('_', ' ')}`}
                {' · '}{row.expires_at ? `${active(row) ? 'Expires' : 'Expired'} ${new Date(row.expires_at).toLocaleString()}` : 'No expiry'}
              </div>
            </div>
            <button type="button" onClick={() => remove(row.id)} style={miniBtn(RED)}>Remove block</button>
          </div>
        ))}
        {rows && rows.length === 0 && <p style={{ color: MUTED }}>No blocked {blockType === 'email' ? 'email addresses' : 'IP addresses'}.</p>}
        {!rows && <p style={{ color: MUTED }}>Loading…</p>}
      </div>
    </div>
  );
}

// ── shared styles ──
function Shell({ children, wide }) {
  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: wide ? 1000 : 420, margin: '0 auto', background: wide ? 'transparent' : CARD, border: wide ? 'none' : `1px solid ${BORDER}`, borderRadius: 16, padding: wide ? 0 : 28 }}>
        {children}
      </div>
    </div>
  );
}
const cardStyle = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 };
const inp = { width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${BORDER}`, fontSize: 15, outline: 'none', background: '#ffffff', color: TEXT };
const btn = (bg) => ({ width: '100%', marginTop: 14, padding: '12px', borderRadius: 10, border: 'none', background: bg, color: '#ffffff', fontWeight: 700, fontSize: 15, cursor: 'pointer' });
const miniBtn = (bg) => ({ padding: '7px 12px', borderRadius: 8, border: 'none', background: bg, color: bg === 'transparent' ? undefined : '#ffffff', fontWeight: 700, fontSize: 13, cursor: 'pointer' });
