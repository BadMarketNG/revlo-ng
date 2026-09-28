'use client';
import { useState, useEffect, useCallback } from 'react';
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

export default function AdminPage() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [tab, setTab] = useState('stats');
  const [activeCount, setActiveCount] = useState(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    // The query string is an external browser value and is intentionally
    // synchronized once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (['stats', 'reports', 'posts', 'emails', 'bm', 'features', 'email-blocks', 'ip-blocks'].includes(requested)) setTab(requested);
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
        {[['stats', 'Stats'], ['reports', 'Reports'], ['posts', 'All Posts'], ['emails', 'Emails'], ['bm', 'BadMarket'], ['features', 'Badges & Promos'], ['email-blocks', 'Email Blocks'], ['ip-blocks', 'IP Blocks']].map(([k, label]) => (
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
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '7px 0' }}>
                <div style={{ color: SUBTLE, fontSize: 12 }}><strong style={{ color: TEXT }}>{entry.reason}</strong> · {new Date(entry.created_at).toLocaleString('en-GB')}</div>
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

function Features() {
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState('');
  const [promo, setPromo] = useState({ title: '', description: '', image_url: '', target_url: '', category: '', days: 7 });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
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
      setPromo({ title: '', description: '', image_url: '', target_url: '', category: '', days: 7 });
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
  const number = (field, label, suffix = '') => (
    <label style={{ display: 'grid', gap: 6, color: SUBTLE, fontSize: 13, fontWeight: 700 }}>
      {label}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="number" min="1" value={settings[field]} onChange={(e) => setSettings((s) => ({ ...s, [field]: Number(e.target.value) }))} style={inp} />
        {suffix && <span style={{ color: MUTED }}>{suffix}</span>}
      </div>
    </label>
  );
  return <div style={{ display: 'grid', gap: 18 }}>
    {message && <div style={{ ...cardStyle, color: message.includes('saved') || message.includes('created') ? GREEN : RED }}>{message}</div>}
    <section style={cardStyle}>
      <h2 style={{ color: TEXT, marginTop: 0 }}>Community badges</h2>
      <p style={{ color: MUTED }}>Thresholds count successful posts from the same verified email. Silver unlocks video publishing.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
        {number('silver_posts', 'Silver posts')}{number('bronze_posts', 'Bronze posts')}{number('gold_posts', 'Gold posts')}
        {number('premium_min_posts', 'Green eligibility posts')}{number('premium_price_kobo', 'Green price', 'kobo')}{number('premium_days', 'Green validity', 'days')}
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
        <div style={{ display: 'flex', gap: 10 }}><select style={inp} value={promo.category} onChange={(e) => setPromo((p) => ({ ...p, category: e.target.value }))}><option value="">All categories</option>{Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><input style={inp} type="number" min="1" max="365" value={promo.days} onChange={(e) => setPromo((p) => ({ ...p, days: Number(e.target.value) }))} /></div>
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
