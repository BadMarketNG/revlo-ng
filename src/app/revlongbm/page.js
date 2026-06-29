'use client';
import { useState, useEffect, useCallback } from 'react';

const GREEN = '#1B5E20';
const RED = '#D32F2F';
const DUR_LABEL = { now: 'RIGHT NOW (24h)', '1m': '1 MONTH', '2m': '2 MONTHS', '3m': '3 MONTHS' };

export default function AdminPage() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('stats');

  useEffect(() => {
    fetch('/api/admin/session')
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.admin))
      .catch(() => setAuthed(false));
  }, []);

  const login = async () => {
    setErr('');
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pw }),
    });
    if (r.ok) { setAuthed(true); setPw(''); setUser(''); }
    else setErr('Incorrect username or password');
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
  };

  if (authed === null) {
    return <Shell><p style={{ color: '#888' }}>Checking…</p></Shell>;
  }

  if (!authed) {
    return (
      <Shell>
        <h1 style={{ color: GREEN, marginTop: 0 }}>Revlo.ng Admin</h1>
        <p style={{ color: '#666' }}>Enter your admin credentials to continue.</p>
        <input
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
          placeholder="Username"
          autoComplete="off"
          style={{ ...inp, marginBottom: 12 }}
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
          placeholder="Password"
          style={inp}
        />
        {err && <p style={{ color: RED, fontSize: 14 }}>{err}</p>}
        <button onClick={login} style={btn(GREEN)}>Log in</button>
      </Shell>
    );
  }

  return (
    <Shell wide>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: GREEN, margin: 0 }}>Revlo.ng Admin</h1>
        <button onClick={logout} style={{ ...btn('#555'), width: 'auto', padding: '8px 16px' }}>Log out</button>
      </div>
      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0' }}>
        {[['stats', 'Stats'], ['reports', 'Reports'], ['posts', 'All posts'], ['emails', 'Emails'], ['bm', 'BadMarket']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, background: tab === k ? GREEN : '#eee', color: tab === k ? '#fff' : '#444' }}>{label}</button>
        ))}
      </nav>
      {tab === 'stats' && <Stats />}
      {tab === 'reports' && <Reports />}
      {tab === 'posts' && <AllPosts />}
      {tab === 'emails' && <Emails />}
      {tab === 'bm' && <BMLinks />}
      <p style={{ marginTop: 40, fontSize: 13, color: '#aaa' }}>
        <a href="/" style={{ color: '#888' }}>← Back to site</a> · Admin view shows hidden emails and controls. Public users never see these.
      </p>
    </Shell>
  );
}

function Stats() {
  const [s, setS] = useState(null);
  useEffect(() => { fetch('/api/admin/stats').then((r) => r.json()).then((d) => setS(d.stats)); }, []);
  if (!s) return <p style={{ color: '#888' }}>Loading…</p>;
  const card = (label, val, color = GREEN) => (
    <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 18, minWidth: 130 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{val}</div>
      <div style={{ fontSize: 13, color: '#777', marginTop: 4 }}>{label}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {card('Active posts', s.active)}
        {card('Expired', s.expired, '#999')}
        {card('Deleted', s.deleted, RED)}
        {card('Total views', s.totalViews.toLocaleString())}
        {card('Followers', s.follows, '#1565c0')}
        {card('Reports', s.reports, '#b45309')}
        {card('BadMarket links', s.bmLinks, '#b45309')}
      </div>
      <h3 style={{ marginTop: 28 }}>Active posts by duration</h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {Object.entries(s.byDuration).map(([k, v]) => card(DUR_LABEL[k], v))}
      </div>
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
  if (!rows) return <p style={{ color: '#888' }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: '#888' }}>No reports. 🎉</p>;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {rows.map((r) => (
        <div key={r.uid} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16, opacity: r.deleted ? 0.55 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong>{r.title}</strong> <span style={{ color: '#999', fontSize: 13 }}>{r.uid} · {r.location}</span>
              <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>Contact: {r.poster_email}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ background: '#fff3e0', color: '#b45309', borderRadius: 6, padding: '3px 8px', fontWeight: 700, fontSize: 13 }}>{r.count} report{r.count > 1 ? 's' : ''}</span>
                {Object.entries(r.reasons).map(([reason, c]) => (
                  <span key={reason} style={{ marginLeft: 8, fontSize: 13, color: '#777' }}>{reason}: {c}</span>
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
  const load = useCallback(() => { fetch('/api/admin/posts?all=1').then((r) => r.json()).then((d) => setRows(d.posts || [])); }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (uid, action, duration) => {
    await fetch('/api/admin/post-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, action, duration }) });
    load();
  };
  if (!rows) return <p style={{ color: '#888' }}>Loading…</p>;
  const ql = q.trim().toLowerCase();
  const filtered = rows.filter((p) => !ql || p.title.toLowerCase().includes(ql) || (p.poster_email || '').includes(ql) || p.uid.toLowerCase().includes(ql) || (p.location || '').toLowerCase().includes(ql));
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, email, uid, location…" style={{ ...inp, marginBottom: 16 }} />
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map((p) => {
          const expired = new Date(p.expires_at) < new Date();
          return (
            <div key={p.uid} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14, opacity: p.deleted_at ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong>{p.title}</strong>{' '}
                  <span style={{ color: '#999', fontSize: 13 }}>{p.uid} · {p.location}</span>
                  {p.deleted_at && <span style={{ marginLeft: 8, color: RED, fontSize: 12, fontWeight: 700 }}>DELETED</span>}
                  {!p.deleted_at && expired && <span style={{ marginLeft: 8, color: '#999', fontSize: 12, fontWeight: 700 }}>EXPIRED</span>}
                  <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Contact: {p.poster_email} · {p.views} views · {p.followers} followers</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select defaultValue={p.duration} onChange={(e) => act(p.uid, 'change_duration', e.target.value)} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ccc' }}>
                    {Object.entries(DUR_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  {p.deleted_at
                    ? <button onClick={() => act(p.uid, 'restore')} style={miniBtn(GREEN)}>Restore</button>
                    : <button onClick={() => act(p.uid, 'soft_delete')} style={miniBtn(RED)}>Delete</button>}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p style={{ color: '#888' }}>No posts match.</p>}
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
  if (!data) return <p style={{ color: '#888' }}>Loading…</p>;
  return (
    <div>
      <h3>Poster emails ({data.posters.length})</h3>
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14, marginBottom: 24, fontSize: 14, columns: 2 }}>
        {data.posters.map((e) => <div key={e} style={{ padding: '2px 0' }}>{e}</div>)}
        {data.posters.length === 0 && <span style={{ color: '#888' }}>None yet.</span>}
      </div>
      <h3>Follow subscriptions ({data.follows.length})</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {data.follows.map((f, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 14 }}>
            <span><strong>{f.follower_email}</strong> follows <strong>{f.poster_email}</strong></span>
            <button onClick={() => unsub(f.poster_email, f.follower_email)} style={miniBtn('#b45309')}>Unsubscribe</button>
          </div>
        ))}
        {data.follows.length === 0 && <p style={{ color: '#888' }}>No subscriptions yet.</p>}
      </div>
    </div>
  );
}

function BMLinks() {
  const [rows, setRows] = useState(null);
  useEffect(() => { fetch('/api/admin/bm-links').then((r) => r.json()).then((d) => setRows(d.links || [])); }, []);
  if (!rows) return <p style={{ color: '#888' }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: '#888' }}>No BadMarket links yet.</p>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((l, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '10px 14px', fontSize: 14 }}>
          <strong>{l.title}</strong> <span style={{ color: '#999' }}>{l.uid}</span>
          <div style={{ color: '#666', marginTop: 4 }}>Payout: {l.payout_email}</div>
        </div>
      ))}
    </div>
  );
}

// ── shared styles ──
function Shell({ children, wide }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f7', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: wide ? 900 : 420, margin: '0 auto', background: wide ? 'transparent' : '#fff', borderRadius: 16, padding: wide ? 0 : 28, boxShadow: wide ? 'none' : '0 4px 24px rgba(0,0,0,0.06)' }}>
        {children}
      </div>
    </div>
  );
}
const inp = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #ddd', fontSize: 15, outline: 'none' };
const btn = (bg) => ({ width: '100%', marginTop: 14, padding: '12px', borderRadius: 10, border: 'none', background: bg, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' });
const miniBtn = (bg) => ({ padding: '7px 12px', borderRadius: 8, border: 'none', background: bg, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' });
