'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

const CATEGORIES = [
  ['for_sale', 'An item'],
  ['rentals', 'A place to rent'],
  ['general', 'A service'],
  ['jobs', 'Work for myself'],
];
const localDateTime = (date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function WantedForm() {
  const [stage, setStage] = useState('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [human, setHuman] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('for_sale');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState(() => localDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [windowBounds] = useState(() => {
    const now = Date.now();
    return { min: localDateTime(new Date(now + 60 * 60 * 1000)), max: localDateTime(new Date(now + 72 * 60 * 60 * 1000)) };
  });

  useEffect(() => {
    const params = new URLSearchParams(locationSearch());
    const urlToken = params.get('token');
    const saved = sessionStorage.getItem('revlo_wanted_publish_token');
    const candidate = urlToken || saved;
    if (urlToken) {
      params.delete('token');
      history.replaceState(null, '', `/wanted${params.size ? `?${params}` : ''}`);
    }
    if (!candidate) return;
    fetch(`/api/magic-link?token=${encodeURIComponent(candidate)}`, { cache: 'no-store' })
      .then(async (response) => { const data = await response.json(); if (!response.ok || !data.valid) throw new Error('This publish link has expired. Request another one.'); return data; })
      .then((data) => { sessionStorage.setItem('revlo_wanted_publish_token', candidate); setToken(candidate); setEmail(data.email); setStage('form'); })
      .catch((cause) => { sessionStorage.removeItem('revlo_wanted_publish_token'); setError(cause.message); setStage('email'); });
  }, []);

  async function requestLink(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, purpose: 'wanted' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send your link.');
      setStage('sent');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }

  async function publish(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poster_email: email, publish_token: token, post_type: 'wanted',
          category, title: title.trim(), description: description.trim(), location: location.trim(),
          budget_max: category === 'jobs' ? null : budget.trim() || null, needed_by: new Date(deadline).toISOString(),
          duration: '1m', media_type: 'images', header_url: null, thumb_url: null, gallery: [],
          contact_visibility: 'public', followable: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not publish your request.');
      sessionStorage.removeItem('revlo_wanted_publish_token');
      window.location.assign(new URL(`/app.html#post-${encodeURIComponent(data.post.uid)}`, window.location.origin).href);
    } catch (cause) { setError(cause.message); setBusy(false); }
  }

  return (
    <main className="wanted-page">
      <Script src="/revlo-turnstile.js" strategy="afterInteractive" />
      <div className="wanted-shell">
        <a className="wanted-back" href="/app.html">← Back to Revlo</a>
        <span className="wanted-kicker">WANTED ON REVLO</span>
        <h1>Tell people what you need.</h1>
        <p className="wanted-intro">Ask for an item, a place to rent, a service, or work. People with an answer can reply through Revlo.</p>
        {stage === 'email' && (
          <form onSubmit={requestLink} className="wanted-form">
            <label>Your email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label className="wanted-human"><input type="checkbox" checked={human} onChange={(event) => setHuman(event.target.checked)} /> I&apos;m not a robot</label>
            <button disabled={busy || !human}>{busy ? 'Sending…' : 'Email me a posting link'}</button>
            <p className="wanted-note">We verify your email before publishing. It is not shown on the post.</p>
          </form>
        )}
        {stage === 'sent' && <div className="wanted-panel" role="status"><h2>Check your email</h2><p>Open the Revlo publish link we sent to <strong>{email}</strong>. It will bring you back here to finish your request.</p></div>}
        {stage === 'form' && (
          <form onSubmit={publish} className="wanted-form">
            <label>{category === 'jobs' ? 'What work can you do?' : 'What do you need?'}<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={category === 'jobs' ? 'e.g. Driver available in Lagos' : 'e.g. Used fridge in good condition'} /></label>
            <label>Type<select value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Where?<input required maxLength={200} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Ikeja, Lagos" /></label>
            {category !== 'jobs' && <label>Maximum budget in ₦ <span>(optional)</span><input type="number" min="1" max="9999999999.99" step="0.01" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="e.g. 40000" /></label>}
            <label>Needed by<input type="datetime-local" required min={windowBounds.min} max={windowBounds.max} value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
            <label>Useful details <span>(optional)</span><textarea maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Condition, size, timing, or anything a responder should know" /></label>
            <p className="wanted-note">Your request is free and closes by your deadline, within three days. No photo is needed. Your email is hidden on the post; a direct reply can share contact details with the responder.</p>
            <button disabled={busy || !windowBounds.min}>{busy ? 'Publishing…' : 'Post what I need'}</button>
          </form>
        )}
        {error && <p className="wanted-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}

function locationSearch() { return window.location.search; }
