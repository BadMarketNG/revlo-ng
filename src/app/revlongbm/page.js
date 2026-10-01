'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';

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

function useCategoryCatalogue() {
  const [categories, setCategories] = useState(() => Object.entries(CAT_LABEL).map(([slug, label], index) => ({ slug, label, position: (index + 1) * 10 })));
  useEffect(() => {
    fetch('/api/categories', { cache: 'no-store' }).then((response) => response.json())
      .then((body) => { if (Array.isArray(body.categories) && body.categories.length) setCategories(body.categories); })
      .catch(() => {});
  }, []);
  return categories;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [tab, setTab] = useState('stats');
  const [activeCount, setActiveCount] = useState(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    // The query string is an external browser value and is intentionally
    // synchronized once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (['stats', 'reports', 'posts', 'emails', 'bm', 'features', 'categories', 'email-blocks', 'ip-blocks'].includes(requested)) setTab(requested);
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
        {[['stats', 'Stats'], ['reports', 'Reports'], ['posts', 'All Posts'], ['emails', 'Emails'], ['bm', 'BadMarket'], ['features', 'Badges & Promos'], ['users', 'Users & Email'], ['collusion', 'Collusion'], ['marketing', 'Email Marketing'], ['moderation', 'Moderation'], ['email-log', 'Email log'], ['categories', 'Categories'], ['email-blocks', 'Email Blocks'], ['ip-blocks', 'IP Blocks']].map(([k, label]) => (
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
      {tab === 'features' && <Features />}
      {tab === 'users' && <UsersAndEmail />}
      {tab === 'collusion' && <Collusion />}
      {tab === 'marketing' && <Marketing />}
      {tab === 'moderation' && <Moderation />}
      {tab === 'email-log' && <EmailLog />}
      {tab === 'categories' && <Categories />}
      {tab === 'email-blocks' && <BlockList blockType="email" />}
      {tab === 'ip-blocks' && <BlockList blockType="ip" />}
      <p style={{ marginTop: 40, fontSize: 12, color: MUTED, borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
        Admin view shows hidden emails and full controls. Public users never see these. · © 2026 Revlo.ng
      </p>
    </Shell>
  );
}

function Categories() {
  const [rows, setRows] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState('');
  const load = useCallback(() => fetch('/api/categories', { cache: 'no-store' })
    .then((response) => response.json())
    .then((body) => {
      setRows(body.categories || []);
      setDrafts(Object.fromEntries((body.categories || []).map((category) => [category.slug, category.label])));
    }), []);
  useEffect(() => { load(); }, [load]);

  const request = async (method, body) => {
    setMessage('');
    const response = await fetch('/api/categories', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error || 'Could not update categories.');
      return false;
    }
    setMessage('Categories updated.');
    await load();
    return true;
  };

  const create = async () => {
    if (await request('POST', { label: newLabel })) setNewLabel('');
  };
  const rename = (slug) => request('PATCH', { slug, label: drafts[slug] });
  const remove = (category) => {
    if (!confirm(`Delete “${category.label}”? Existing posts will move to General.`)) return;
    request('DELETE', { slug: category.slug });
  };
  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const order = rows.map((row) => row.slug);
    [order[index], order[target]] = [order[target], order[index]];
    await request('PATCH', { order });
  };

  if (!rows) return <p style={{ color: MUTED }}>Loading…</p>;
  return <div style={{ display: 'grid', gap: 16 }}>
    {message && <div style={{ ...cardStyle, color: message.includes('updated') ? GREEN : RED }}>{message}</div>}
    <section style={cardStyle}>
      <h2 style={{ color: TEXT, marginTop: 0 }}>Post categories</h2>
      <p style={{ color: MUTED, lineHeight: 1.5 }}>Create, rename, delete, or reorder the categories shown to publishers and visitors. Deleting a category safely moves its existing posts to General.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap', marginTop: 16 }}>
        <input value={newLabel} maxLength={32} onChange={(event) => setNewLabel(event.target.value)} placeholder="New category name" style={{ ...inp, flex: '1 1 260px' }} />
        <button type="button" onClick={create} disabled={newLabel.trim().length < 2} style={{ ...miniBtn(GREEN), opacity: newLabel.trim().length < 2 ? 0.55 : 1 }}>Add category</button>
      </div>
    </section>
    <section style={{ ...cardStyle, display: 'grid', gap: 10 }}>
      {rows.map((category, index) => <div key={category.slug} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) auto', gap: 10, alignItems: 'center', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12 }}>
        <div>
          <input value={drafts[category.slug] ?? category.label} maxLength={32} onChange={(event) => setDrafts((current) => ({ ...current, [category.slug]: event.target.value }))} style={inp} aria-label={`Rename ${category.label}`} />
          <div style={{ color: MUTED, fontSize: 12, marginTop: 5 }}>Key: {category.slug}{category.protected ? ' · required fallback' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => move(index, -1)} disabled={index === 0} style={{ ...miniBtn('#475467'), opacity: index === 0 ? 0.45 : 1 }} aria-label={`Move ${category.label} earlier`}>↑</button>
          <button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1} style={{ ...miniBtn('#475467'), opacity: index === rows.length - 1 ? 0.45 : 1 }} aria-label={`Move ${category.label} later`}>↓</button>
          <button type="button" onClick={() => rename(category.slug)} disabled={(drafts[category.slug] || '').trim() === category.label} style={{ ...miniBtn(BLUE), opacity: (drafts[category.slug] || '').trim() === category.label ? 0.5 : 1 }}>Rename</button>
          <button type="button" onClick={() => remove(category)} disabled={category.protected} style={{ ...miniBtn(RED), opacity: category.protected ? 0.45 : 1 }}>Delete</button>
        </div>
      </div>)}
    </section>
  </div>;
}

function Stats() {
  const [s, setS] = useState(null);
  const categories = useCategoryCatalogue();
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
            {Object.entries(s.byCategory).map(([k, v]) => card(categories.find((category) => category.slug === k)?.label || CAT_LABEL[k] || k, v, CAT_COLOR[k] || GREEN))}
          </div>
        </>
      )}
    </div>
  );
}

function Reports() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { fetch('/api/admin/reports').then((r) => r.json()).then((d) => setRows(d.reports || [])); }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (uid, action) => {
    await fetch('/api/admin/post-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, action }) });
    load();
  };
  const deleteReport = async ({ reportId, postId, count = 1 }) => {
    const message = reportId
      ? 'Delete this report permanently? This cannot be undone.'
      : `Delete all ${count} reports for this post permanently? This cannot be undone.`;
    if (!confirm(message)) return;
    setError('');
    const response = await fetch('/api/admin/reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportId ? { report_id: reportId } : { post_id: postId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Could not delete report');
      return;
    }
    load();
  };
  if (!rows) return <p style={{ color: MUTED }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: MUTED }}>No reports. 🎉</p>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {error && <div style={{ ...cardStyle, color: RED }}>{error}</div>}
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
              <button onClick={() => deleteReport({ postId: r.post_id, count: r.count })} style={miniBtn('#7f1d1d')}>Delete all reports</button>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 14, paddingTop: 8, display: 'grid', gap: 7 }}>
            {(r.entries || []).map((entry) => (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', padding: '10px 0' }}>
                <div style={{ color: SUBTLE, fontSize: 12, flex: 1, minWidth: 240 }}>
                  <strong style={{ color: TEXT }}>{entry.reason}</strong> · {new Date(entry.created_at).toLocaleString('en-GB')}
                  <div style={{ marginTop: 5 }}>Verified reporter: <strong style={{ color: TEXT }}>{entry.reporter_email || 'Legacy anonymous report'}</strong></div>
                  {entry.details && <div style={{ marginTop: 7, whiteSpace: 'pre-wrap', color: TEXT }}>{entry.details}</div>}
                  {entry.evidence?.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
                      {entry.evidence.map((file, index) => (
                        <a key={file.path} href={file.url} target="_blank" rel="noreferrer" title={`Open evidence ${index + 1}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={file.url} alt={`Report evidence ${index + 1}`} style={{ width: 92, height: 70, objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}` }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteReport({ reportId: entry.id })} style={miniBtn(RED)}>Delete report</button>
              </div>
            ))}
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
  const categories = useCategoryCatalogue();

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
        {['all', ...categories.map((category) => category.slug)].map((c) => (
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
            {c === 'all' ? 'All' : categories.find((category) => category.slug === c)?.label || CAT_LABEL[c] || c}
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
                        {categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}
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
                              {categories.find((category) => category.slug === p.category)?.label || CAT_LABEL[p.category] || p.category}
                            </span>
                          )}
                          {p.deleted_at && <span style={{ marginLeft: 8, color: RED, fontSize: 12, fontWeight: 700 }}>DELETED</span>}
                          {!p.deleted_at && expired && <span style={{ marginLeft: 8, color: MUTED, fontSize: 12, fontWeight: 700 }}>EXPIRED</span>}
                          <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Contact: {p.poster_email} · IP: {p.source_ip || 'Unavailable'} · {p.views} views · {p.followers} followers</div>
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

// NOTE (2026-09-29): administrator badge awards/removals and emails to users.
// Every badge change and message is emailed with the Revlo template.
const BADGE_LABEL = { silver: 'Silver', bronze: 'Bronze', gold: 'Gold' };

function UsersAndEmail() {
  const [email, setEmail] = useState('');
  const [publisher, setPublisher] = useState(null);
  const [reason, setReason] = useState('');
  const [badgeMessage, setBadgeMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState({ to: '', subject: '', message: '' });
  const [mailMessage, setMailMessage] = useState('');

  const lookup = async () => {
    setBadgeMessage(''); setPublisher(null);
    const res = await fetch(`/api/admin/publishers?email=${encodeURIComponent(email.trim())}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setBadgeMessage(body.error || 'Could not look up this email.'); return; }
    setPublisher(body.publisher);
    setMail((current) => ({ ...current, to: body.publisher.email }));
  };

  const change = async (action, badge) => {
    const label = action === 'award' ? `award the ${BADGE_LABEL[badge]} badge to` : action === 'remove' ? 'remove the badge from' : 'restore the earned badge for';
    if (!window.confirm(`Are you sure you want to ${label} ${publisher.email}? They will be emailed.`)) return;
    setBusy(true); setBadgeMessage('');
    const res = await fetch('/api/admin/publishers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: publisher.email, action, badge, reason }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setBadgeMessage(body.error || 'Could not change the badge.'); return; }
    setPublisher(body.publisher); setReason('');
    setBadgeMessage(body.emailSent ? 'Saved. The user has been emailed.' : 'Saved, but the notification email could not be sent.');
  };

  const send = async () => {
    setBusy(true); setMailMessage('');
    const res = await fetch('/api/admin/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mail) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMailMessage(body.error || 'Could not send the email.'); return; }
    setMailMessage(`Sent to ${mail.to}.`); setMail((current) => ({ ...current, subject: '', message: '' }));
  };

  const badgeText = (value) => (value ? BADGE_LABEL[value] : 'None');
  const overrideText = !publisher ? '' : publisher.badgeOverride === 'none' ? 'Removed by an administrator' : publisher.badgeOverride ? `Awarded by an administrator (${BADGE_LABEL[publisher.badgeOverride]})` : 'None: the earned badge applies';

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Badges</h2>
        <p style={{ color: MUTED, marginTop: 0 }}>Award any badge, or remove one, including a badge the user earned. The user is emailed every time.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={inp} type="email" placeholder="Publisher email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') lookup(); }} />
          <button style={{ ...miniBtn(GREEN), whiteSpace: 'nowrap' }} onClick={lookup} disabled={!email.includes('@')}>Look up</button>
        </div>
        {publisher && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '4px 0' }}><strong>{publisher.email}</strong> · {publisher.publishedPosts} published posts</p>
            <p style={{ margin: '4px 0' }}>Current badge: <strong>{badgeText(publisher.effectiveBadge)}</strong> · Earned from posts: {badgeText(publisher.earnedBadge)}</p>
            <p style={{ margin: '4px 0', color: MUTED }}>Administrator setting: {overrideText}</p>
            <textarea style={{ ...inp, marginTop: 10, minHeight: 70 }} placeholder="Reason (optional, included in the email)" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {['silver', 'bronze', 'gold'].map((badge) => (
                <button key={badge} style={miniBtn('#b8860b')} disabled={busy} onClick={() => change('award', badge)}>Award {BADGE_LABEL[badge]}</button>
              ))}
              <button style={miniBtn(RED)} disabled={busy} onClick={() => change('remove')}>Remove badge</button>
              {publisher.badgeOverride && <button style={miniBtn('#475467')} disabled={busy} onClick={() => change('restore')}>Restore earned badge</button>}
            </div>
          </div>
        )}
        {badgeMessage && <p style={{ marginBottom: 0 }}>{badgeMessage}</p>}
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Email a user</h2>
        <p style={{ color: MUTED, marginTop: 0 }}>Sent with the Revlo email template. The subject starts with “Revlo.ng ·” and replies go to support@revlo.ng.</p>
        <input style={inp} type="email" placeholder="Recipient email" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} />
        <input style={{ ...inp, marginTop: 10 }} placeholder="Subject" value={mail.subject} maxLength={120} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
        <textarea style={{ ...inp, marginTop: 10, minHeight: 160 }} placeholder="Message" value={mail.message} maxLength={5000} onChange={(e) => setMail({ ...mail, message: e.target.value })} />
        <button style={btn(GREEN)} disabled={busy || !mail.to.includes('@') || mail.subject.trim().length < 2 || mail.message.trim().length < 2} onClick={send}>{busy ? 'Sending…' : 'Send email'}</button>
        {mailMessage && <p style={{ marginBottom: 0 }}>{mailMessage}</p>}
      </section>
    </div>
  );
}

// NOTE (2026-09-30): collusion report. Flags posters whose followers look
// fabricated (see src/lib/collusion.js for the formula), with CSV export and
// actions. Follower IP addresses are shown here to administrators only.
const BAND_STYLE = {
  likely_fabricated: { label: 'Likely fabricated', color: '#b91c1c', bg: '#fef2f2' },
  review: { label: 'Review', color: '#b45309', bg: '#fffbeb' },
  low: { label: 'Low', color: '#15803d', bg: '#f0fdf4' },
  insufficient: { label: 'Too few followers', color: '#667085', bg: '#f2f4f7' },
};
const SIGNAL_LABELS = { D: 'Same device as poster', I: 'Same IP as poster', C: 'Followers share IPs/devices', B: 'Follows in bursts (10 min)', S: 'Followers do nothing else', V: 'Fast growth for account age', Q: 'Many followers per post', A: 'New account', E: 'Follower emails bounce or complain', R: 'Followers shared with another poster (ring)' };

function Collusion() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState('50');
  const load = useCallback(() => {
    fetch('/api/admin/collusion', { cache: 'no-store' }).then((r) => r.json()).then((d) => { if (d.error) setError(d.error); else { setError(''); setRows(d.report); } }).catch(() => setError('Could not load the report.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (poster) => {
    setMessage(''); setDetail({ loading: true, poster });
    const d = await fetch(`/api/admin/collusion?poster=${encodeURIComponent(poster)}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ error: 'Could not load this poster.' }));
    setDetail(d.error ? { error: d.error, poster } : d.detail);
  };

  const pct = Number(percent);
  const pctValid = Number.isInteger(pct) && pct >= 1 && pct <= 100;
  const removeCount = detail?.followers && pctValid ? Math.min(detail.followers, Math.ceil((detail.followers * pct) / 100)) : 0;

  const toggleReason = async (follower, hide) => {
    setBusy(true); setMessage('');
    const res = await fetch('/api/admin/collusion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poster: detail.poster, follower, action: hide ? 'hide_reason' : 'show_reason' }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? (hide ? 'Note hidden from the public.' : 'Note shown again.') : body.error || 'The action failed.');
    if (res.ok) open(detail.poster);
  };

  const act = async (action) => {
    const label = action === 'delete_posts' ? 'delete ALL posts by' : action === 'clear_caution' ? 'clear the caution (and its post warning) for' : action === 'remove_percent' ? `remove ${removeCount} of ${detail.followers} followers (${pct}%, most suspicious first) from` : 'remove ALL follows of';
    if (!window.confirm(`Are you sure you want to ${label} ${detail.poster}? This cannot be undone from here.`)) return;
    setBusy(true); setMessage('');
    const res = await fetch('/api/admin/collusion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poster: detail.poster, action, percent: pct }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? (action === 'clear_caution' ? 'Warning cleared. A new caution is still sent at the next 10 fabricated followers.' : action === 'remove_percent' ? `Done: ${body.affected} followers removed. The list is in the admin log.` : `Done: ${body.affected} ${action === 'delete_posts' ? 'posts deleted' : 'follows removed'}.`) : body.error || 'The action failed.');
    if (res.ok) { load(); open(detail.poster); }
  };

  const badge = (band) => { const b = BAND_STYLE[band] || BAND_STYLE.low; return <span style={{ background: b.bg, color: b.color, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>{b.label}</span>; };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Collusion report</h2>
          <a href="/api/admin/collusion?format=csv" style={{ ...miniBtn(GREEN), textDecoration: 'none' }}>Export report (CSV)</a>
        </div>
        <p style={{ color: MUTED }}>Posters are emailed a caution automatically every time another 10 followers are judged fabricated (10, 20, 30…), and are warned when they create a post. A follower is judged fabricated when the poster scores 80+ and the follower used the poster&apos;s device, or does nothing else and shares the poster&apos;s or another follower&apos;s network or device.</p>
        <p style={{ color: MUTED }}>Posters with at least 3 followers, scored 0–100 for signs that followers were fabricated: the same device or network as the poster, followers sharing devices or networks, follows in bursts, followers who do nothing else, and fast growth on a new account with few posts. 80+ is likely fabricated, 50–79 needs review. Device and network signals are recorded from 30 September 2026 onward.</p>
        {error && <p style={{ color: RED }}>{error}</p>}
        {!rows ? <p style={{ color: MUTED }}>Loading…</p> : rows.length === 0 ? <p style={{ color: MUTED }}>No posters with 3 or more followers yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: MUTED }}><th style={{ padding: 8 }}>Poster</th><th>Score</th><th>Fabricated</th><th>Cautions sent</th><th>Followers</th><th>Posts</th><th>Account age</th><th>Gained over</th><th></th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.poster} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: 8, fontWeight: 700 }}>{r.poster}</td>
                  <td>{r.score ?? '—'} {badge(r.band)}{r.ringPartners?.length > 0 && <span title="Shares 5+ followers with another poster" style={{ marginLeft: 6, color: '#7c3aed', fontSize: 12, fontWeight: 800 }}>ring</span>}</td>
                  <td>{r.fabricatedFollowers}</td>
                  <td>{r.cautions.length ? r.cautions.map((c) => <div key={c.id} style={{ whiteSpace: 'nowrap' }}>{new Date(c.cautioned_at).toLocaleDateString('en-GB')} · {c.level}{c.cleared_at ? ' (cleared)' : ''}</div>) : '—'}</td>
                  <td>{r.followers}</td><td>{r.posts}</td><td>{r.accountAgeDays} days</td><td>{r.followSpanHours} h</td>
                  <td><button style={miniBtn('#1f2937')} onClick={() => open(r.poster)}>Open</button></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail && (
        <section style={cardStyle}>
          {detail.loading ? <p style={{ color: MUTED }}>Loading {detail.poster}…</p> : detail.error ? <p style={{ color: RED }}>{detail.error}</p> : (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{detail.poster} · {detail.score ?? '—'} {badge(detail.band)}</h2>
              <a href={`/api/admin/collusion?poster=${encodeURIComponent(detail.poster)}&format=csv`} style={{ ...miniBtn(GREEN), textDecoration: 'none' }}>Export followers (CSV)</a>
            </div>
            {detail.cautions.length > 0 && (
              <div style={{ background: '#fffbeb', color: '#92400e', borderRadius: 8, padding: '8px 10px' }}>
                <strong>{detail.cautions.length} {detail.cautions.length === 1 ? 'caution' : 'cautions'} sent{detail.cautionActive ? ' · the poster sees a warning when creating posts' : ' · warning cleared'}</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                  {detail.cautions.map((c) => <li key={c.id}>{new Date(c.cautioned_at).toLocaleString('en-GB')} · at {c.level} fabricated followers (score {c.score}){c.email_sent ? '' : ' · email failed to send'}{c.cleared_at ? ` · cleared ${new Date(c.cleared_at).toLocaleDateString('en-GB')}` : ''}</li>)}
                </ul>
              </div>
            )}
            <p style={{ color: MUTED }}>{detail.fabricatedFollowers} of {detail.followers} followers judged fabricated · {detail.followers} followers · {detail.posts} posts · account {detail.accountAgeDays} days old · followers gained over {detail.followSpanHours} hours (median gap {detail.medianGapMinutes ?? '—'} min).</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
              {Object.entries(detail.signals).map(([key, value]) => (
                <div key={key} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8 }}>
                  <div style={{ fontSize: 12, color: MUTED }}>{key} · {SIGNAL_LABELS[key]}</div>
                  <div style={{ height: 6, background: '#eef2f6', borderRadius: 6, marginTop: 6 }}><div style={{ width: `${Math.round(value * 100)}%`, height: '100%', background: value > 0.6 ? RED : value > 0.3 ? '#d97706' : GREEN, borderRadius: 6 }} /></div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{Math.round(value * 100)}%</div>
                </div>))}
            </div>

            {detail.ringPartners?.length > 0 && (<>
              <h3 style={{ fontSize: 15, marginBottom: 6 }}>Possible follow ring</h3>
              <p style={{ color: MUTED, fontSize: 13, marginTop: 0 }}>Other posters followed by 5 or more of the same followers. Large overlaps suggest traded or bought follows.</p>
              <ul style={{ marginTop: 0, fontSize: 13 }}>{detail.ringPartners.map((r) => <li key={r.poster}><button style={{ background: 'none', border: 0, padding: 0, color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }} onClick={() => open(r.poster)}>{r.poster}</button> · {r.sharedFollowers} shared followers ({Math.round(r.share * 100)}% of this poster&apos;s)</li>)}</ul>
            </>)}
            <h3 style={{ fontSize: 15, marginBottom: 6 }}>Followers by IP address</h3>
            {detail.ipGroups.map((group) => (
              <details key={group.ip} open={group.count > 1 || group.posterUsedIp} style={{ border: `1px solid ${group.posterUsedIp ? RED : BORDER}`, borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{group.ip} · {group.count} {group.count === 1 ? 'follower' : 'followers'}{group.posterUsedIp && <span style={{ color: RED }}> · poster also used this IP</span>}</summary>
                <table style={{ width: '100%', fontSize: 12, marginTop: 6, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ textAlign: 'left', color: MUTED }}><th>Follower</th><th>Followed</th><th>Confirm IP</th><th>Same device</th><th>Does nothing else</th><th>Other flags</th><th>Judged fabricated</th><th>Public note</th></tr></thead>
                  <tbody>{group.followers.map((f) => (
                    <tr key={f.email} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td style={{ padding: '4px 0' }}>{f.email}</td><td>{new Date(f.followedAt).toLocaleString('en-GB')}</td><td>{f.confirmIp || '—'}</td>
                      <td style={{ color: f.deviceMatch ? RED : undefined }}>{f.deviceMatch ? 'Yes' : 'No'}</td><td>{f.singlePurpose ? 'Yes' : 'No'}</td><td style={{ color: RED }}>{[f.aliasOfPoster && 'Poster’s own inbox', f.sharedInbox && 'Same inbox as another follower', f.emailFailed && 'Email bounced/complained'].filter(Boolean).join(' · ') || '—'}</td><td style={{ color: detail.score >= 80 && f.suspect ? RED : undefined }}>{detail.score >= 80 && f.suspect ? 'Yes' : 'No'}</td>
                      <td style={{ maxWidth: 260 }}>{f.reason ? <><span style={{ textDecoration: f.reasonHidden ? 'line-through' : 'none', color: f.reasonHidden ? MUTED : undefined }}>“{f.reason}”</span> <button style={{ ...miniBtn(f.reasonHidden ? GREEN : '#475467'), padding: '2px 8px', fontSize: 11 }} disabled={busy} onClick={() => toggleReason(f.email, !f.reasonHidden)}>{f.reasonHidden ? 'Show' : 'Hide'}</button></> : '—'}</td>
                    </tr>))}
                  </tbody>
                </table>
              </details>))}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button style={miniBtn(RED)} disabled={busy} onClick={() => act('delete_posts')}>Delete all posts by this user</button>
              <button style={miniBtn('#b45309')} disabled={busy} onClick={() => act('remove_follows')}>Remove all their follows</button>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '3px 6px' }}>
                <label htmlFor="collusion-percent" style={{ fontSize: 12, fontWeight: 700 }}>Remove</label>
                <input id="collusion-percent" type="number" min="1" max="100" step="1" value={percent} onChange={(e) => setPercent(e.target.value)} style={{ width: 64, padding: '4px 6px', border: `1px solid ${BORDER}`, borderRadius: 6 }} />
                <span style={{ fontSize: 12 }}>% of followers</span>
                <button style={miniBtn('#9a3412')} disabled={busy || !pctValid || removeCount === 0} onClick={() => act('remove_percent')}>Remove {removeCount}</button>
              </span>
              {detail.cautionActive && <button style={miniBtn('#475467')} disabled={busy} onClick={() => act('clear_caution')}>Clear caution</button>}
            </div>
            <p style={{ color: MUTED, fontSize: 12 }}>Removing a percentage takes the most suspicious followers first: same device as the poster, then same IP, then shared with other followers, then followers who do nothing else, then the most recent. Export the followers CSV first if you may need the evidence.</p>
            {message && <p>{message}</p>}
          </>)}
        </section>
      )}
    </div>
  );
}

// NOTE (2026-09-30): email marketing. Admins write a campaign as plain text or
// HTML (scripts are removed: email apps never run them), add images, preview it
// in the "News & offers" template, send a test, then send to an audience.
const EMPTY_CAMPAIGN = { id: null, subject: '', preheader: '', mode: 'text', body: '', audience: 'everyone' };
const CAMPAIGN_STATUS = { draft: ['Draft', '#475467'], sending: ['Sending', '#b45309'], sent: ['Sent', '#15803d'], cancelled: ['Cancelled', '#b91c1c'] };

function Marketing() {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(EMPTY_CAMPAIGN);
  const [preview, setPreview] = useState({ html: '', removed: [] });
  const [testTo, setTestTo] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const bodyRef = useRef(null);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    fetch('/api/admin/marketing', { cache: 'no-store' }).then((r) => r.json()).then(setData).catch(() => setMessage('Could not load campaigns.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const post = async (payload) => {
    const res = await fetch('/api/admin/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Something went wrong.');
    return body;
  };

  // Live preview, shortly after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      post({ action: 'preview', ...draft }).then(setPreview).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [draft]);

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const editable = !draft.id || (data?.campaigns || []).find((c) => c.id === draft.id)?.status === 'draft';

  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const { campaign } = await post({ action: 'save', ...draft });
      setDraft({ id: campaign.id, subject: campaign.subject, preheader: campaign.preheader || '', mode: campaign.mode, body: campaign.body, audience: campaign.audience });
      setMessage('Draft saved.'); load();
      return campaign;
    } catch (error) { setMessage(error.message); return null; } finally { setBusy(false); }
  };

  const insertAtCursor = (text) => {
    const el = bodyRef.current;
    setDraft((d) => {
      const at = el ? el.selectionStart : d.body.length;
      return { ...d, body: `${d.body.slice(0, at)}${text}${d.body.slice(at)}` };
    });
  };

  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setMessage('');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/marketing/image', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(body.error || 'Upload failed.'); return; }
    insertAtCursor(draft.mode === 'html'
      ? `\n<img src="${body.url}" alt="" style="display:block;width:100%;max-width:520px;height:auto;border-radius:10px;">\n`
      : `\n\n${body.url}\n\n`);
    setMessage('Image added where your cursor was.');
  };

  const test = async () => {
    const campaign = await save();
    if (!campaign) return;
    setBusy(true);
    try { await post({ action: 'test', id: campaign.id, to: testTo }); setMessage(`Test sent to ${testTo}.`); }
    catch (error) { setMessage(error.message); } finally { setBusy(false); }
  };

  const runBatches = async (id) => {
    for (;;) {
      const { done, campaign } = await post({ action: 'batch', id });
      setProgress(campaign);
      if (done) break;
    }
  };

  const send = async () => {
    const campaign = await save();
    if (!campaign) return;
    const count = data?.counts?.[campaign.audience];
    if (!window.confirm(`Send "${campaign.subject}" to ${count ?? 'every'} ${AUDIENCE_LABEL[campaign.audience]}? This cannot be undone.`)) return;
    setBusy(true); setMessage('');
    try {
      const { total } = await post({ action: 'start', id: campaign.id });
      setMessage(`Sending to ${total} people. Keep this page open until it finishes.`);
      await runBatches(campaign.id);
      setMessage('Campaign sent.');
    } catch (error) { setMessage(error.message); } finally { setBusy(false); load(); }
  };

  const resume = async (id) => {
    setBusy(true); setMessage('Resuming…');
    try { await runBatches(id); setMessage('Campaign sent.'); } catch (error) { setMessage(error.message); } finally { setBusy(false); load(); }
  };

  const cancel = async (id) => {
    if (!window.confirm('Stop this campaign? Emails already sent cannot be recalled.')) return;
    try { await post({ action: 'cancel', id }); setMessage('Campaign cancelled.'); load(); } catch (error) { setMessage(error.message); }
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: `1px solid ${BORDER}`, borderRadius: 8, font: 'inherit' };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{draft.id ? 'Edit campaign' : 'New campaign'}</h2>
          {draft.id && <button style={miniBtn('#475467')} onClick={() => { setDraft(EMPTY_CAMPAIGN); setMessage(''); }}>Start a new one</button>}
        </div>
        <p style={{ color: MUTED }}>Sent with Revlo&apos;s gold-and-green &quot;News &amp; offers&quot; template, with an unsubscribe link in every email. People who unsubscribed, bounced, marked Revlo as spam or are blocked are left out automatically. Scripts, forms and click handlers are removed from HTML: email apps never run JavaScript.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>
          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Subject<input style={input} maxLength={150} value={draft.subject} onChange={set('subject')} disabled={!editable} /></label>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Preview line <span style={{ fontWeight: 400, color: MUTED }}>(shown next to the subject in inboxes)</span><input style={input} maxLength={200} value={draft.preheader} onChange={set('preheader')} disabled={!editable} /></label>
            <label style={{ fontWeight: 700, fontSize: 13 }}>Send to
              <select style={input} value={draft.audience} onChange={set('audience')} disabled={!editable}>
                {Object.entries(data?.audiences || {}).map(([key, label]) => <option key={key} value={key}>{label}{data?.counts?.[key] != null ? ` · ${data.counts[key]} people` : ''}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {[['text', 'Plain text'], ['html', 'HTML']].map(([key, label]) => (
                <button key={key} disabled={!editable} onClick={() => setDraft((d) => ({ ...d, mode: key }))} style={{ ...miniBtn(draft.mode === key ? GREEN : '#98a2b3') }}>{label}</button>
              ))}
              <button style={miniBtn('#1d4ed8')} disabled={busy || !editable} onClick={() => fileRef.current?.click()}>Add image</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
            <textarea ref={bodyRef} value={draft.body} onChange={set('body')} disabled={!editable} rows={16}
              placeholder={draft.mode === 'html' ? '<p>Hello from Revlo!</p>\n<p><a href="https://revlo.ng/app.html">See what is new</a></p>' : 'Write your message. Leave a blank line between paragraphs.\n\nLinks become clickable, and images you add appear where you put them.'}
              style={{ ...input, fontFamily: draft.mode === 'html' ? 'ui-monospace, Menlo, monospace' : 'inherit', fontSize: 14, resize: 'vertical' }} />
            {preview.removed?.length > 0 && <p style={{ color: '#b45309', fontSize: 13, margin: 0 }}>Removed before sending: {preview.removed.join(', ')}.</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button style={miniBtn('#475467')} disabled={busy || !editable} onClick={save}>Save draft</button>
              <input style={{ ...input, width: 220 }} placeholder="Send a test to…" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <button style={miniBtn('#1d4ed8')} disabled={busy || !testTo} onClick={test}>Send test</button>
              <button style={miniBtn(RED)} disabled={busy || !editable} onClick={send}>Send campaign</button>
            </div>
            {progress && progress.status === 'sending' && (
              <div>
                <div style={{ height: 8, background: '#eef2f6', borderRadius: 8 }}><div style={{ width: `${progress.total ? Math.round(((progress.sent + progress.failed + progress.skipped) / progress.total) * 100) : 0}%`, height: '100%', background: GREEN, borderRadius: 8 }} /></div>
                <p style={{ fontSize: 13, color: MUTED }}>{progress.sent} sent · {progress.failed} failed · {progress.skipped} skipped of {progress.total}</p>
              </div>
            )}
            {message && <p style={{ margin: 0 }}>{message}</p>}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Preview</div>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} style={{ width: '100%', height: 640, border: `1px solid ${BORDER}`, borderRadius: 10, background: '#fff' }} />
          </div>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Campaigns</h2>
        {!data ? <p style={{ color: MUTED }}>Loading…</p> : data.campaigns.length === 0 ? <p style={{ color: MUTED }}>No campaigns yet.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: MUTED }}><th style={{ padding: 8 }}>Subject</th><th>Audience</th><th>Status</th><th>Sent</th><th>Failed</th><th>Skipped</th><th>Date</th><th></th></tr></thead>
            <tbody>{data.campaigns.map((c) => {
              const [label, color] = CAMPAIGN_STATUS[c.status] || [c.status, MUTED];
              return (
                <tr key={c.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td style={{ padding: 8, fontWeight: 700 }}>{c.subject}</td>
                  <td>{c.audience}</td>
                  <td style={{ color, fontWeight: 800 }}>{label}</td>
                  <td>{c.sent}{c.total ? ` / ${c.total}` : ''}</td><td>{c.failed}</td><td>{c.skipped}</td>
                  <td>{new Date(c.finished_at || c.started_at || c.created_at).toLocaleString('en-GB')}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button style={miniBtn('#1f2937')} onClick={() => { setDraft({ id: c.id, subject: c.subject, preheader: c.preheader || '', mode: c.mode, body: c.body, audience: c.audience }); setMessage(c.status === 'draft' ? '' : 'Sent campaigns are read-only. Start a new one to reuse the content.'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Open</button>
                    {c.status === 'sending' && <> <button style={miniBtn(GREEN)} disabled={busy} onClick={() => resume(c.id)}>Resume</button></>}
                    {(c.status === 'draft' || c.status === 'sending') && <> <button style={miniBtn(RED)} disabled={busy} onClick={() => cancel(c.id)}>Cancel</button></>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
// NOTE (2026-10-01): moderation — posts auto-flagged for contact details, and
// email suspensions (no posting, following or contacting followers).
function Moderation() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: '', days: '', reason: '' });
  const load = useCallback(() => {
    fetch('/api/admin/moderation', { cache: 'no-store' }).then((r) => r.json()).then((d) => { if (d.error) setMessage(d.error); else setData(d); }).catch(() => setMessage('Could not load moderation.'));
  }, []);
  useEffect(() => { load(); }, [load]);
  const post = async (payload, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return null;
    setBusy(true); setMessage('');
    const res = await fetch('/api/admin/moderation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(body.error || 'The action failed.'); return null; }
    load();
    return body;
  };
  const days = form.days || data?.defaultDays || 10;
  const suspend = async (email, reason) => {
    const target = email || form.email;
    const result = await post({ action: 'suspend', email: target, days: Number(days), reason: reason ?? form.reason }, `Suspend ${target} for ${days} days? They will be emailed, and cannot post, follow or contact followers until it ends.`);
    if (result) { setMessage(`Suspended ${target} for ${days} days.${result.emailSent ? ' They have been emailed.' : ' The email could not be sent.'}`); setForm({ email: '', days: '', reason: '' }); }
  };
  const highlight = (text, matches) => {
    let out = [String(text || '')];
    for (const m of matches || []) {
      out = out.flatMap((part) => typeof part !== 'string' ? [part] : part.split(m.value).flatMap((piece, i, arr) => i < arr.length - 1 ? [piece, <mark key={`${m.value}-${i}-${piece.length}`} style={{ background: '#fee2e2', color: RED, fontWeight: 700 }}>{m.value}</mark>] : [piece]));
    }
    return out;
  };
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {message && <div style={{ ...cardStyle, color: message.startsWith('Suspended') || message.includes('removed') ? GREEN : RED }}>{message}</div>}
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Posts with contact details</h2>
        <p style={{ color: MUTED }}>New posts are checked automatically for phone numbers, email addresses, links, WhatsApp/Telegram mentions and social handles. Prices and sizes can look like numbers, so each one waits here for a decision. Removing a post emails the publisher to explain why.</p>
        {!data ? <p style={{ color: MUTED }}>Loading…</p> : data.flags.length === 0 ? <p style={{ color: MUTED }}>Nothing to review.</p> : data.flags.map((flag) => (
          <div key={flag.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong>{flag.post?.title || flag.post_uid} <span style={{ color: MUTED, fontWeight: 400 }}>· {flag.post_uid} · {flag.poster_email}</span></strong>
              <span style={{ color: MUTED, fontSize: 12 }}>{new Date(flag.created_at).toLocaleString('en-GB')}{flag.post?.deleted_at ? ' · already removed' : ''}</span>
            </div>
            <p style={{ margin: '8px 0', whiteSpace: 'pre-wrap', fontSize: 14 }}>{highlight(`${flag.post?.title || ''}\n${flag.post?.description || ''}${flag.post?.tags?.length ? `\nTags: ${flag.post.tags.join(', ')}` : ''}`, flag.matches)}</p>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: RED }}>Found: {(flag.matches || []).map((m) => `${m.kind} “${m.value}”`).join(' · ')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button style={miniBtn(RED)} disabled={busy} onClick={async () => { if (await post({ action: 'remove_post', flagId: flag.id }, 'Remove this post and email the publisher?')) setMessage('Post removed and the publisher emailed.'); }}>Remove post</button>
              <button style={miniBtn('#475467')} disabled={busy} onClick={() => post({ action: 'dismiss', flagId: flag.id })}>Dismiss (no contact details)</button>
              <button style={miniBtn('#b45309')} disabled={busy} onClick={() => suspend(flag.poster_email, 'Contact details in a post')}>Suspend publisher ({days} days)</button>
            </div>
          </div>
        ))}
      </section>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Suspensions</h2>
        <p style={{ color: MUTED }}>A suspended email cannot publish, follow or contact followers. They are emailed when suspended and see a countdown when they try to post. The default length is set under Badges &amp; Promos.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input placeholder="Email address" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={{ ...inp, width: 240 }} />
          <input type="number" min="1" placeholder={`${data?.defaultDays || 10}`} value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))} style={{ ...inp, width: 90 }} aria-label="Days" />
          <span style={{ color: MUTED, fontSize: 13 }}>days</span>
          <input placeholder="Reason (included in the email)" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} style={{ ...inp, width: 280 }} />
          <button style={miniBtn('#b45309')} disabled={busy || !form.email} onClick={() => suspend()}>Suspend</button>
        </div>
        {!data ? null : data.suspensions.length === 0 ? <p style={{ color: MUTED }}>No active suspensions.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: MUTED }}><th style={{ padding: 6 }}>Email</th><th>Until</th><th>Reason</th><th>By</th><th></th></tr></thead>
            <tbody>{data.suspensions.map((s) => (
              <tr key={s.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                <td style={{ padding: 6, fontWeight: 700 }}>{s.email}</td><td>{new Date(s.until).toLocaleString('en-GB')}</td><td>{s.reason || '—'}</td><td>{s.created_by || '—'}</td>
                <td><button style={miniBtn(GREEN)} disabled={busy} onClick={async () => { if (await post({ action: 'lift', email: s.email }, `Lift the suspension on ${s.email}?`)) setMessage(`Suspension on ${s.email} lifted.`); }}>Lift</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// NOTE (2026-10-01): every email Revlo sends, with search, filters, ordering,
// CSV export and deletion. Contents are not stored.
const EMPTY_LOG_FILTERS = { status: '', q: '', from: '', to: '', sort: 'newest' };
const logQuery = (filters, extra = {}) => new URLSearchParams(Object.entries({ ...filters, ...extra }).filter(([, value]) => value)).toString();
function EmailLog() {
  const [filters, setFilters] = useState(EMPTY_LOG_FILTERS);
  const [applied, setApplied] = useState(EMPTY_LOG_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    fetch(`/api/admin/email-log?${logQuery(applied, { page: String(page) })}`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => { if (d.error) setMessage(d.error); else { setData(d); setSelected(new Set()); } })
      .catch(() => setMessage('Could not load the email log.'));
  }, [applied, page]);
  useEffect(() => { load(); }, [load]);
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const remove = async (payload, text) => {
    if (!window.confirm(text)) return;
    setBusy(true); setMessage('');
    const res = await fetch('/api/admin/email-log', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(res.ok ? `Deleted ${body.deleted} ${body.deleted === 1 ? 'entry' : 'entries'}.` : body.error || 'Could not delete.');
    if (res.ok) load();
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const small = { ...inp, width: 'auto', padding: '8px 10px', fontSize: 13 };
  const statusColor = { sent: GREEN, failed: RED, skipped: MUTED };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Email log</h2>
        <p style={{ color: MUTED }}>Every email Revlo sends: publish links, follow and contact confirmations, cautions, suspensions and marketing. Contents are not stored. BadMarket and RRSource emails are in their admin panel under Admin+ &rarr; Email Log.</p>
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(filters); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
          <input style={{ ...small, width: 240 }} placeholder="Email address or subject" value={filters.q} onChange={set('q')} aria-label="Search" />
          <select style={small} value={filters.status} onChange={set('status')} aria-label="Status"><option value="">All statuses</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option></select>
          <input type="date" style={small} value={filters.from} onChange={set('from')} aria-label="From date" />
          <input type="date" style={small} value={filters.to} onChange={set('to')} aria-label="To date" />
          <select style={small} value={filters.sort} onChange={set('sort')} aria-label="Order"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
          <button type="submit" style={miniBtn('#1f2937')}>Apply</button>
          <button type="button" style={miniBtn('#98a2b3')} onClick={() => { setFilters(EMPTY_LOG_FILTERS); setApplied(EMPTY_LOG_FILTERS); setPage(1); }}>Reset</button>
        </form>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          <a href={`/api/admin/email-log?${logQuery(applied, { format: 'csv' })}`} style={{ ...miniBtn(GREEN), textDecoration: 'none' }}>Export matching (CSV)</a>
          <button style={miniBtn(RED)} disabled={busy || selected.size === 0} onClick={() => remove({ ids: [...selected] }, `Delete ${selected.size} selected entries? This cannot be undone.`)}>Delete selected ({selected.size})</button>
          <button style={miniBtn(RED)} disabled={busy || !data?.total} onClick={() => remove({ filter: applied, confirm: true }, `Delete all ${data?.total || 0} entries matching the filters? This cannot be undone. Export first if you need a copy.`)}>Delete all matching ({data?.total || 0})</button>
          {message && <span style={{ fontSize: 13 }}>{message}</span>}
        </div>
      </section>
      <section style={{ ...cardStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: MUTED }}>
            <th style={{ padding: 6 }}><input type="checkbox" aria-label="Select all on this page" checked={Boolean(data?.rows.length) && data.rows.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(data.rows.map((r) => r.id)) : new Set())} /></th>
            <th>Sent</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
          <tbody>{!data ? <tr><td colSpan={5} style={{ padding: 8, color: MUTED }}>Loading…</td></tr> : data.rows.length === 0 ? <tr><td colSpan={5} style={{ padding: 8, color: MUTED }}>No emails match.</td></tr> : data.rows.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${BORDER}` }}>
              <td style={{ padding: 6 }}><input type="checkbox" aria-label={`Select email to ${r.to_email}`} checked={selected.has(r.id)} onChange={(e) => setSelected((cur) => { const next = new Set(cur); if (e.target.checked) next.add(r.id); else next.delete(r.id); return next; })} /></td>
              <td style={{ whiteSpace: 'nowrap', color: MUTED }}>{new Date(r.created_at).toLocaleString('en-GB')}</td>
              <td style={{ fontWeight: 700 }}>{r.to_email}</td><td>{r.subject}</td>
              <td style={{ color: statusColor[r.status], fontWeight: 700 }} title={r.error || ''}>{r.status}{r.error ? `: ${r.error.slice(0, 50)}` : ''}</td>
            </tr>))}</tbody>
        </table>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
          <button style={miniBtn('#475467')} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {pages} · {data?.total || 0} emails</span>
          <button style={miniBtn('#475467')} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </section>
    </div>
  );
}

const AUDIENCE_LABEL = { publishers: 'publishers', followers: 'followers', everyone: 'publishers and followers' };

function Features() {
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState('');
  const [promo, setPromo] = useState({ title: '', description: '', image_url: '', target_url: '', category: '', placement: 'feed', days: 7 });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const categories = useCategoryCatalogue();
  const load = useCallback(() => fetch('/api/admin/features', { cache: 'no-store' }).then((r) => r.json()).then((d) => setSettings(d.settings)), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  if (!settings) return <p style={{ color: MUTED }}>Loading…</p>;
  const save = async () => {
    setMessage('');
    const response = await fetch('/api/admin/features', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    const body = await response.json();
    setMessage(response.ok ? 'Settings saved.' : body.error || 'Could not save settings.');
    if (response.ok) setSettings(body.settings);
  };
  const createPromo = async () => {
    setMessage('');
    setCreatingPromo(true);
    try {
      let imageUrl = promo.image_url;
      if (imageFile) {
        const form = new FormData();
        form.append('file', imageFile);
        const uploadResponse = await fetch('/api/admin/promotion-image', { method: 'POST', body: form });
        const uploadBody = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || !uploadBody.url) throw new Error(uploadBody.error || 'Could not upload header image.');
        imageUrl = uploadBody.url;
      }
      const response = await fetch('/api/admin/features', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...promo, image_url: imageUrl }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not create promotion.');
      setMessage('Admin promotion created.');
      setPromo({ title: '', description: '', image_url: '', target_url: '', category: '', placement: 'feed', days: 7 });
      setImageFile(null);
      setImagePreview('');
      setFileInputKey((key) => key + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create promotion.');
    } finally {
      setCreatingPromo(false);
    }
  };
  const chooseImage = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setMessage('Use a JPEG, PNG, GIF, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image is too large (maximum 5 MB).');
      event.target.value = '';
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMessage('');
  };
  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
    setFileInputKey((key) => key + 1);
  };
  // NOTE (2026-10-01): optional minimum, so tag and follower-contact limits can be 0.
  const number = (field, label, suffix = '', min = 1) => (
    <label style={{ display: 'grid', gap: 6, color: SUBTLE, fontSize: 13, fontWeight: 700 }}>
      {label}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" min={min} value={settings[field] ?? ''} onChange={(e) => setSettings((s) => ({ ...s, [field]: Number(e.target.value) }))} style={inp} />
        {suffix && <span style={{ color: MUTED }}>{suffix}</span>}
      </div>
    </label>
  );
  return <div style={{ display: 'grid', gap: 18 }}>
    {message && <div style={{ ...cardStyle, color: message.includes('saved') || message.includes('created') ? GREEN : RED }}>{message}</div>}
    <section style={cardStyle}>
      <h2 style={{ color: TEXT, marginTop: 0 }}>Community badges</h2>
      <p style={{ color: MUTED }}>Thresholds count successful posts from the same verified email. Silver unlocks video publishing. Posts per link is how many posts one emailed publish link creates for each badge, with no time limit (maximum 1,000). Without a badge a link creates up to the no-badge number of posts within 30 minutes (default 5).</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
        {number('silver_posts', 'Silver posts')}{number('bronze_posts', 'Bronze posts')}{number('gold_posts', 'Gold posts')}
        {number('normal_link_posts', 'Posts per link (no badge)')}{number('silver_link_posts', 'Silver posts per link')}{number('bronze_link_posts', 'Bronze posts per link')}{number('gold_link_posts', 'Gold posts per link')}
        {number('premium_min_posts', 'Green eligibility posts')}{number('premium_price_kobo', 'Green price', 'kobo')}{number('premium_days', 'Green validity', 'days')}
      </div>
    </section>
    <section style={cardStyle}>
      <h2 style={{ color: TEXT, marginTop: 0 }}>Search tags, follower contact and suspensions</h2>
      <p style={{ color: MUTED }}>Search tags a publisher may add to each post, by badge (a promoted post gets the promoted number). Followers a publisher without a badge may contact from each post; Bronze can contact half of their contactable followers, and Silver, Gold and paying publishers can contact all of them. Suspension days is the default offered when suspending an email. Saved with the button below.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
        {number('tags_normal', 'Tags (no badge)', '', 0)}{number('tags_bronze', 'Tags (Bronze)', '', 0)}{number('tags_silver', 'Tags (Silver)', '', 0)}{number('tags_gold', 'Tags (Gold)', '', 0)}{number('tags_promoted', 'Tags (promoted post)', '', 0)}
        {number('normal_follower_contacts', 'Followers contactable per post (no badge)', '', 0)}{number('suspension_default_days', 'Default suspension', 'days')}
      </div>
    </section>
    <section style={cardStyle}>
      <h2 style={{ color: TEXT, marginTop: 0 }}>Promoted posts</h2>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: TEXT, fontWeight: 700, marginBottom: 14 }}><input type="checkbox" checked={settings.promotions_enabled} onChange={(e) => setSettings((s) => ({ ...s, promotions_enabled: e.target.checked }))} /> Enable user promotions</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
        {number('promo_price_per_day_kobo', 'Price per day', 'kobo')}{number('promo_min_days', 'Minimum days')}{number('promo_max_days', 'Maximum days')}
      </div>
      <button onClick={save} style={{ ...miniBtn(GREEN), marginTop: 16 }}>Save badge and promotion settings</button>
    </section>
    <section style={cardStyle}>
      <h2 style={{ color: TEXT, marginTop: 0 }}>Create an admin promotion</h2>
      <p style={{ color: MUTED }}>Use this for house campaigns or external ads. It rotates with paid promotions every 20 seconds.</p>
      <div style={{ display: 'grid', gap: 10 }}>
        <input style={inp} value={promo.title} onChange={(e) => setPromo((p) => ({ ...p, title: e.target.value }))} placeholder="Promotion title" />
        <textarea style={{ ...inp, minHeight: 72 }} value={promo.description} onChange={(e) => setPromo((p) => ({ ...p, description: e.target.value }))} placeholder="Description" />
        <div style={{ border: `1px dashed ${BORDER}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
          <strong style={{ color: TEXT, fontSize: 14 }}>Header image</strong>
          <span style={{ color: MUTED, fontSize: 12 }}>Upload JPEG, PNG, GIF, or WebP · maximum 5 MB. A wide landscape image works best.</span>
          <input key={fileInputKey} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={chooseImage} style={{ color: SUBTLE }} />
          {imagePreview && <div style={{ position: 'relative' }}>
            <Image src={imagePreview} alt="Promotion header preview" width={1600} height={700} unoptimized style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 280, aspectRatio: '16 / 7', objectFit: 'cover', borderRadius: 10, border: `1px solid ${BORDER}` }} />
            <button type="button" onClick={clearImage} style={{ ...miniBtn(RED), position: 'absolute', top: 10, right: 10 }}>Remove image</button>
          </div>}
          <span style={{ color: MUTED, fontSize: 12 }}>Or provide an externally hosted image:</span>
          <input style={inp} value={promo.image_url} onChange={(e) => setPromo((p) => ({ ...p, image_url: e.target.value }))} placeholder="Image URL (optional)" disabled={Boolean(imageFile)} />
        </div>
        <input style={inp} value={promo.target_url} onChange={(e) => setPromo((p) => ({ ...p, target_url: e.target.value }))} placeholder="Destination URL" />
        <label style={{ display: 'grid', gap: 6, color: SUBTLE, fontSize: 13, fontWeight: 700 }}>
          Advert placement
          <select style={inp} value={promo.placement} onChange={(e) => setPromo((p) => ({ ...p, placement: e.target.value }))}>
            <option value="feed">Listings — top and throughout the page</option>
            <option value="header">Header advert — beside the post button</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: 10 }}><select style={inp} value={promo.category} onChange={(e) => setPromo((p) => ({ ...p, category: e.target.value }))}><option value="">All categories</option>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select><input style={inp} type="number" min="1" max="365" value={promo.days} onChange={(e) => setPromo((p) => ({ ...p, days: Number(e.target.value) }))} /></div>
        <button onClick={createPromo} disabled={creatingPromo} style={{ ...miniBtn(BLUE), opacity: creatingPromo ? 0.65 : 1 }}>{creatingPromo ? (imageFile ? 'Uploading header image…' : 'Creating promotion…') : 'Create promotion'}</button>
      </div>
    </section>
  </div>;
}

function Emails() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateSort, setDateSort] = useState('newest');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const load = useCallback(() => {
    setError('');
    fetch('/api/admin/emails', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Could not load email activity');
        return body;
      })
      .then(setData)
      .catch((loadError) => setError(loadError.message));
  }, []);
  // `load` performs an asynchronous fetch before updating state; this is the
  // initial subscription read for the email activity panel.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  const unsub = async (poster_email, follower_email) => {
    await fetch('/api/admin/emails', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poster_email, follower_email }) });
    load();
  };
  if (error) return <div style={{ ...cardStyle, color: RED }}>{error} <button onClick={load} style={miniBtn(GREEN)}>Retry</button></div>;
  if (!data) return <p style={{ color: MUTED }}>Loading…</p>;
  const links = [...(data.publishLinks || []), ...(data.historicalPosts || [])]
    .sort((a, b) => new Date(b.requested_at || 0) - new Date(a.requested_at || 0));
  const sentCount = links.filter((row) => row.delivery_status === 'sent').length;
  const openedCount = links.filter((row) => row.opened_at).length;
  const createdCount = links.filter((row) => row.redeemed_at || row.post_uid).length;
  const recipientMap = links.reduce((map, row) => {
    const key = String(row.email || '').toLowerCase();
    if (!map.has(key)) map.set(key, { email: row.email, rows: [] });
    map.get(key).rows.push(row);
    return map;
  }, new Map());
  const recipients = Array.from(recipientMap.values())
    .sort((a, b) => new Date(b.rows[0]?.requested_at || 0) - new Date(a.rows[0]?.requested_at || 0));
  const selectedRecipient = selectedEmail ? recipientMap.get(selectedEmail.toLowerCase()) : null;
  const fmt = (value) => value
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
    : '—';
  const statusFor = (row) => {
    if (row.post_uid || row.redeemed_at) return { label: 'Post created', color: GREEN, background: '#eaf7ef' };
    if (row.opened_at) return { label: 'Link opened', color: BLUE, background: '#eff6ff' };
    if (row.delivery_status === 'failed') return { label: 'Delivery failed', color: RED, background: '#fef2f2' };
    if (row.delivery_status === 'pending') return { label: 'Sending', color: AMBER, background: '#fff7ed' };
    return { label: 'Link sent', color: SUBTLE, background: '#f2f4f7' };
  };
  const matchesStatus = (row) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'created') return !!(row.post_uid || row.redeemed_at);
    if (statusFilter === 'opened') return !!row.opened_at && !(row.post_uid || row.redeemed_at);
    if (statusFilter === 'failed') return row.delivery_status === 'failed';
    return row.delivery_status === 'sent' && !row.opened_at && !(row.post_uid || row.redeemed_at);
  };
  const visibleRecipients = recipients
    .filter((recipient) => recipient.email.toLowerCase().includes(emailSearch.trim().toLowerCase()) && recipient.rows.some(matchesStatus))
    .sort((a, b) => {
      const left = new Date(a.rows[0]?.requested_at || 0).getTime();
      const right = new Date(b.rows[0]?.requested_at || 0).getTime();
      return dateSort === 'oldest' ? left - right : right - left;
    });
  const exportEmails = () => {
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = visibleRecipients
      .flatMap((recipient) => recipient.rows.filter(matchesStatus).map((row) => ({ recipient, row })))
      .sort((a, b) => {
        const left = new Date(a.row.requested_at || 0).getTime();
        const right = new Date(b.row.requested_at || 0).getTime();
        return dateSort === 'oldest' ? left - right : right - left;
      })
      .map(({ recipient, row }) => [
        recipient.email,
        'Your Revlo.ng publish link',
        row.delivery_status,
        row.requested_at,
        row.sent_at,
        row.opened_at,
        row.redeemed_at,
        row.expires_at,
        row.post_uid,
        row.post_title,
        row.deleted_at ? 'deleted' : row.post_uid ? 'active' : '',
      ]);
    const header = ['Email', 'Subject', 'Delivery status', 'Requested at', 'Sent at', 'Opened at', 'Post created at', 'Link expires at', 'Post reference', 'Post title', 'Post status'];
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `revlo-email-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ color: TEXT, fontSize: 22, margin: '0 0 5px' }}>Publish-link activity</h2>
        <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>Every magic link sent to a prospective poster, and whether it was opened or used to create a post.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          ['Magic links sent', sentCount],
          ['Links opened', openedCount],
          ['Posts created', createdCount],
          ['Unique recipients', new Set(links.map((row) => row.email)).size],
        ].map(([label, value]) => (
          <div key={label} style={{ ...cardStyle, padding: '16px 18px' }}>
            <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px' }}>{label}</div>
            <div style={{ color: TEXT, fontSize: 28, fontWeight: 800, marginTop: 5 }}>{value}</div>
          </div>
        ))}
      </div>
      {selectedRecipient && (
        <div style={{ ...cardStyle, marginBottom: 20, padding: 0, overflow: 'hidden', borderColor: '#9acbad' }}>
          <div style={{ background: '#edf8f1', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase' }}>Individual recipient</div>
              <div style={{ color: TEXT, fontSize: 18, fontWeight: 800, marginTop: 3, overflowWrap: 'anywhere' }}>{selectedRecipient.email}</div>
            </div>
            <button onClick={() => setSelectedEmail(null)} style={miniBtn(SUBTLE)}>Close details</button>
          </div>
          <div style={{ padding: '5px 18px 16px' }}>
            {selectedRecipient.rows.map((row) => {
              const status = statusFor(row);
              return (
                <div key={row.id} style={{ borderBottom: `1px solid ${BORDER}`, padding: '13px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 12 }}>
                  <div><div style={{ color: MUTED, fontSize: 11, fontWeight: 700 }}>EMAIL</div><div style={{ color: TEXT, fontSize: 13, marginTop: 4 }}>Your Revlo.ng publish link</div></div>
                  <div><div style={{ color: MUTED, fontSize: 11, fontWeight: 700 }}>SENT</div><div style={{ color: TEXT, fontSize: 13, marginTop: 4 }}>{fmt(row.sent_at || row.requested_at)}</div></div>
                  <div><div style={{ color: MUTED, fontSize: 11, fontWeight: 700 }}>OPENED</div><div style={{ color: TEXT, fontSize: 13, marginTop: 4 }}>{fmt(row.opened_at)}</div></div>
                  <div><div style={{ color: MUTED, fontSize: 11, fontWeight: 700 }}>RESULT</div><div style={{ marginTop: 4 }}><span style={{ display: 'inline-flex', color: status.color, background: status.background, borderRadius: 999, padding: '4px 8px', fontSize: 11, fontWeight: 750 }}>{status.label}</span>{row.post_uid && <div style={{ color: SUBTLE, fontSize: 11, marginTop: 5 }}>{row.post_uid} · {row.post_title || 'Post created'}{row.deleted_at ? ' · Deleted' : ''}</div>}</div></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
          <div><h3 style={{ color: TEXT, fontSize: 16, margin: 0 }}>Individual email recipients ({recipients.length})</h3><div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>Select an address to inspect every publish link and outcome.</div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input value={emailSearch} onChange={(event) => setEmailSearch(event.target.value)} placeholder="Search email address" aria-label="Search email recipients" style={{ ...inp, width: 250, maxWidth: '100%', padding: '9px 11px' }} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter email activity by status" style={{ ...inp, width: 'auto', padding: '9px 11px' }}>
              <option value="all">All statuses</option>
              <option value="sent">Link sent</option>
              <option value="opened">Link opened</option>
              <option value="created">Post created</option>
              <option value="failed">Delivery failed</option>
            </select>
            <select value={dateSort} onChange={(event) => setDateSort(event.target.value)} aria-label="Sort email recipients by date" style={{ ...inp, width: 'auto', padding: '9px 11px' }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button onClick={exportEmails} disabled={visibleRecipients.length === 0} style={{ ...miniBtn(GREEN), opacity: visibleRecipients.length === 0 ? .45 : 1, padding: '9px 12px' }}>Export CSV ({visibleRecipients.length})</button>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 9 }}>
          {visibleRecipients.map((recipient) => {
            const latest = recipient.rows[0];
            const status = statusFor(latest);
            const recipientPosts = recipient.rows.filter((row) => row.post_uid || row.redeemed_at).length;
            return (
              <div key={recipient.email} style={{ ...cardStyle, padding: '14px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 14, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}><div style={{ color: TEXT, fontSize: 14, fontWeight: 750, overflowWrap: 'anywhere' }}>{recipient.email}</div><div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{recipient.rows.length} link{recipient.rows.length === 1 ? '' : 's'} · {recipientPosts} post{recipientPosts === 1 ? '' : 's'}</div></div>
                <div><span style={{ display: 'inline-flex', color: status.color, background: status.background, borderRadius: 999, padding: '5px 9px', fontSize: 12, fontWeight: 750 }}>{status.label}</span><div style={{ color: MUTED, fontSize: 11, marginTop: 5 }}>{fmt(latest.requested_at)}</div></div>
                <button onClick={() => setSelectedEmail(recipient.email)} style={miniBtn(GREEN)}>View details</button>
              </div>
            );
          })}
          {links.length === 0 && <div style={{ ...cardStyle, color: MUTED }}>No publish links have been recorded yet. New magic-link requests will appear here individually.</div>}
          {links.length > 0 && visibleRecipients.length === 0 && <div style={{ ...cardStyle, color: MUTED }}>No recipients match the current search and status filter.</div>}
        </div>
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
  const [builtIn, setBuiltIn] = useState(null);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const label = blockType === 'email' ? 'email address' : 'IP address';

  const load = useCallback(() => {
    fetch('/api/admin/blocks')
      .then((r) => r.json())
      .then((data) => {
        setRows((data.blocks || []).filter((row) => row.block_type === blockType));
        setBuiltIn(data.built_in || null);
      });
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
          {blockType === 'email'
            ? 'Block one address or an entire domain. Blocked people see the normal success message, but Revlo sends no email and does not relay contact to a blocked owner.'
            : 'Revlo-only controls. Manual blocks remain until removed; automatic blocks show their trigger and expiry.'}
        </p>
        {blockType === 'email' && builtIn && (
          <div style={{ background: '#f3f8f3', border: '1px solid #cfe3d1', borderRadius: 10, padding: '10px 12px', marginBottom: 14, color: TEXT, fontSize: 13 }}>
            <strong>{Number(builtIn.count || 0).toLocaleString()} known disposable domains</strong> are also blocked by the bundled {builtIn.snapshot} security snapshot. These rules are not individually removable here.
          </div>
        )}
        <form onSubmit={add} style={{ display: 'grid', gap: 10 }}>
          <input value={value} onChange={(event) => setValue(event.target.value)} style={inp} placeholder={blockType === 'email' ? 'Email or domain, e.g. *@bill.com' : `Enter ${label}`} required />
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
