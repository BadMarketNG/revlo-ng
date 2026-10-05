'use client';

import { useEffect, useState } from 'react';

const green = '#1b5e20';
const border = '#d9e1ea';
const muted = '#667085';
const fallbackCategories = [
  { slug: 'jobs', label: 'Jobs' },
  { slug: 'rentals', label: 'Rentals' },
  { slug: 'for_sale', label: 'For Sale' },
  { slug: 'promotions', label: 'Promotions' },
  { slug: 'general', label: 'General' },
];

const examples = {
  jobs: ['Hiring: Customer Support Officer', 'Tell applicants about pay, location and requirements.'],
  rentals: ['Two-bedroom flat available in Yaba', 'Add rent, terms, amenities and viewing details.'],
  for_sale: ['Dining table for sale', 'Add condition, price and collection details.'],
  promotions: ['Weekend offer at our shop', 'Add the offer, end date and how to claim it.'],
  general: ['What is happening today?', 'Add the details people need to act.'],
  gadgets: ['Samsung Galaxy S23 for sale in Ikeja', '256 GB, clean screen, original box included. Ask for a daytime viewing before paying.'],
  wears: ['New Ankara shirts available in Surulere', 'Sizes M–XXL. State your preferred size and arrange pickup in Surulere.'],
  electronics: ['LG 43-inch TV for sale in Lagos', 'Working condition with remote. Buyer can inspect before paying.'],
  repairs: ['Phone screen repairs in Yaba', 'Same-day inspection and a clear quote before any repair begins.'],
  lodging: ['Weekend room available in Abuja', 'Private room near Wuse with check-in details and nightly rate.'],
};
const wantedExamples = {
  for_sale: ['Used fridge in good condition', 'An item', '₦40,000'],
  rentals: ['Two-bedroom flat in Surulere', 'A place to rent', '₦400,000'],
  general: ['Plumber available today', 'A service', '₦20,000'],
  jobs: ['Driver available in Lagos', 'Work for myself', null],
};
export default function PostCreationPreviews() {
  const [categories, setCategories] = useState(fallbackCategories);
  const [selected, setSelected] = useState('jobs');
  const [requestType, setRequestType] = useState(false);
  const [recentPosts, setRecentPosts] = useState([]);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    fetch('/api/categories', { cache: 'no-store' }).then((response) => response.json())
      .then((body) => { if (Array.isArray(body.categories) && body.categories.length) setCategories(body.categories); })
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => fetch('/api/admin/posts?all=1', { cache: 'no-store' }).then((response) => response.json())
      .then((body) => { if (active && Array.isArray(body.posts)) { setRecentPosts(body.posts); setRefreshedAt(new Date().toLocaleTimeString()); setNow(Date.now()); } })
      .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 60_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, []);

  const label = categories.find((category) => category.slug === selected)?.label || selected;
  const [headline, details] = examples[selected] || [`A new ${label.toLowerCase()} post`, 'Add the details people need to act.'];
  const matchingPosts = recentPosts.filter((post) => post.category === selected && (post.post_type === 'wanted') === requestType && !post.deleted_at && new Date(post.expires_at).getTime() > now).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
  const live = matchingPosts[0];
  const image = !requestType && live?.header_url;
  const gallery = !requestType && Array.isArray(live?.gallery) ? live.gallery : [];
  const hoursLeft = live ? Math.max(1, Math.ceil((new Date(live.expires_at).getTime() - now) / 3_600_000)) : 0;
  const field = { display: 'block', width: '100%', boxSizing: 'border-box', border: `1px solid ${border}`, borderRadius: 10, background: '#fff', padding: '12px 14px', color: '#46556b', font: 'inherit' };

  return <section style={{ background: '#fff', border: `1px solid ${border}`, borderRadius: 14, padding: 24 }}>
    <h2 style={{ margin: '0 0 6px', color: '#172033' }}>Post creation previews</h2>
    <p style={{ color: muted, margin: '0 0 18px' }}>Review the steps and fields a visitor sees before publishing. This admin preview does not create a post or send a magic link.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      <button type="button" onClick={() => setRequestType(false)} style={choice(!requestType)}>Offer something</button>
      <button type="button" onClick={() => { setRequestType(true); if (!wantedExamples[selected]) setSelected('for_sale'); }} style={choice(requestType)}>Post what you need</button>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {(requestType ? categories.filter((category) => wantedExamples[category.slug]) : categories).map((category) => <button key={category.slug} type="button" onClick={() => setSelected(category.slug)} style={choice(selected === category.slug)}>{category.label}</button>)}
    </div>
    <h3 style={{ margin: '0 0 10px' }}>What visitors see in the feed <small style={{ color: muted, fontWeight: 500, fontSize: 12 }}>{refreshedAt ? `· refreshed ${refreshedAt}` : '· loading live posts'}</small></h3>
    {live ? <article style={{ border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden', background: '#fffdf6', marginBottom: 26, maxWidth: 800 }}>
      <div style={{ position: 'relative', height: requestType ? 150 : 280, background: requestType ? 'linear-gradient(135deg,#f5d88b,#f7f1df)' : '#164a2e' }}>
        {image && <img src={image} alt="Post cover photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {image && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 30%,rgba(0,0,0,.78))' }} />}
        <span style={{ position: 'absolute', top: 15, left: 15, padding: '7px 12px', background: '#fff', borderRadius: 99, fontWeight: 800, fontSize: 12, letterSpacing: .5 }}>{requestType ? 'WANTED' : label.toUpperCase()}</span>
        <span style={{ position: 'absolute', top: 15, right: 15, padding: '7px 12px', background: '#bb5706', color: '#fff', borderRadius: 99, fontWeight: 800, fontSize: 12 }}>⏳ {hoursLeft}h left</span>
        <div style={{ position: 'absolute', bottom: 15, left: 18, right: 18, color: image ? '#fff' : '#29362c', display: 'flex', alignItems: 'end', gap: 12 }}>
          {image && <img src={live.thumb_url || image} alt="Post thumbnail" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 10, border: '2px solid white' }} />}
          <strong style={{ fontSize: 25, lineHeight: 1.1, textShadow: image ? '0 2px 4px #333' : 'none' }}>{live.title}</strong>
        </div>
      </div>
      <div style={{ padding: 19 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: muted, fontSize: 13 }}><span>📍 {live.location || 'Location not specified'}</span><span>Live post · {live.uid}</span></div>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: '#29362c' }}>{live.description || 'No description provided.'}</p>
        {gallery.length > 1 && <div style={{ display: 'flex', gap: 7, marginBottom: 16 }}>{gallery.slice(0, 3).map((src, index) => <img key={`${src}-${index}`} src={src} alt={`Post photo ${index + 1}`} style={{ width: 68, height: 54, objectFit: 'cover', borderRadius: 7 }} />)}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {live.contact_visibility !== 'none' && <span style={action(true)}>✉ Contact</span>}
          {!requestType && selected === 'rentals' && <span style={action(false)}>📅 Book a viewing</span>}
          {live.followable !== false && <span style={action(false)}>🔔 Follow</span>}
          <a href={`/app.html#post-${encodeURIComponent(live.uid)}`} target="_blank" rel="noopener noreferrer" style={{ ...action(false), textDecoration: 'none' }}>Open live post ↗</a>
        </div>
      </div>
    </article> : <div style={{ border: `1px dashed ${border}`, borderRadius: 14, padding: 24, color: muted, marginBottom: 26 }}>No live {requestType ? 'wanted request' : 'offer'} in this category. Select another category or open All Posts to inspect expired entries. No sample is shown as if it were current.</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
      {requestType ? <div style={{ background: '#fffdf6', border: `1px solid ${border}`, borderRadius: 14, padding: 20, display: 'grid', gap: 14 }}>
        <span style={{ color: green, fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>WANTED ON REVLO</span>
        <h3 style={{ margin: 0, fontSize: 25 }}>Tell people what you need.</h3>
        <p style={{ margin: 0, color: muted }}>Ask for an item, a place to rent, a service, or work. People with an answer can reply through Revlo.</p>
        <label>{selected === 'jobs' ? 'What work can you do?' : 'What do you need?'}<input readOnly value={(wantedExamples[selected] || wantedExamples.for_sale)[0]} style={field} /></label>
        <label>Type<input readOnly value={(wantedExamples[selected] || wantedExamples.for_sale)[1]} style={field} /></label>
        <label>Where?<input readOnly value="Ikeja, Lagos" style={field} /></label>
        {selected !== 'jobs' && <label>Maximum budget in ₦ (optional)<input readOnly value={(wantedExamples[selected] || wantedExamples.for_sale)[2]} style={field} /></label>}
        <label>Needed by<input readOnly value="Tomorrow" style={field} /></label>
        <label>Useful details (optional)<textarea readOnly value="Condition, size, timing, or anything a responder should know" style={field} /></label>
        <div style={{ background: '#e8eee6', borderRadius: 10, padding: 13, textAlign: 'center', color: green, fontWeight: 800 }}>Post what I need · preview only</div>
      </div> :
      <div style={{ background: '#f8faf7', border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ background: green, minHeight: 130, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'end', padding: 20 }}>
          <strong style={{ fontSize: 21 }}>{requestType ? `Wanted: ${headline}` : headline}</strong>
          <span style={{ fontSize: 13, opacity: .85 }}>Lagos · {label} · 24 hours</span>
        </div>
        <div style={{ padding: 20, display: 'grid', gap: 16 }}>
          <div><strong>01 · Say it</strong><div style={{ marginTop: 8 }}><input aria-label="Preview headline" readOnly value={requestType ? `Looking for ${label.toLowerCase()}` : headline} style={field} /></div><p style={{ color: muted, margin: '8px 0 0' }}>{details}</p></div>
          <div><strong>02 · Where & what</strong><div style={{ marginTop: 8, color: muted }}>📍 Lagos &nbsp; 🏷️ {label}</div></div>
          <div><strong>03 · How long it stays up</strong><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{['18h', '24h', '72h', '1 week', '2½ weeks'].map((duration) => <span key={duration} style={{ padding: '7px 10px', background: duration === '24h' ? green : '#e8eee6', color: duration === '24h' ? '#fff' : '#243729', borderRadius: 8, fontWeight: 700, fontSize: 12 }}>{duration}</span>)}</div></div>
          <div><strong>04 · Show, don’t tell</strong><p style={{ color: muted, margin: '7px 0 0' }}>Header image, thumbnail and optional video.</p></div>
          <div><strong>05 · Who can reach you</strong><p style={{ color: muted, margin: '7px 0 0' }}>Visitors can message or follow; the poster’s email stays hidden.</p></div>
          <div style={{ background: '#e8eee6', borderRadius: 10, padding: 13, textAlign: 'center', color: green, fontWeight: 800 }}>Publish · preview only</div>
        </div>
      </div>}
      <div>
        <h3 style={{ marginTop: 0 }}>Visitor journey</h3>
        <ol style={{ lineHeight: 1.8, color: '#344054', paddingLeft: 22 }}>
          <li>Tap “+ Post” and enter an email address.</li>
          <li>Open the one-time magic link from the email.</li>
          <li>Complete the {requestType ? 'wanted request' : 'post'} form shown here and publish.</li>
          <li>The post appears in the feed and expires at the chosen time.</li>
        </ol>
        <p style={{ color: muted }}>The live public form uses one shared composer for offer categories. The wanted request has its own form.</p>
        <a href={requestType ? '/wanted' : '/app.html'} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', color: green, fontWeight: 800 }}>Open the public {requestType ? 'wanted form' : 'post entry'} ↗</a>
        <h3 style={{ margin: '28px 0 9px' }}>Resulting posts on Revlo</h3>
        {matchingPosts.length ? matchingPosts.map((post) => <div key={post.uid} style={{ border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
          {post.header_url && <img src={post.header_url} alt="" style={{ display: 'block', width: '100%', height: 125, objectFit: 'cover' }} />}
          <div style={{ padding: 13 }}><strong>{post.title}</strong><p style={{ color: muted, fontSize: 13, margin: '6px 0' }}>📍 {post.location || 'Location not specified'} · {label}</p><p style={{ color: '#344054', fontSize: 13, margin: '6px 0' }}>{String(post.description || '').slice(0, 170)}</p><a href={`/app.html#post-${encodeURIComponent(post.uid)}`} target="_blank" rel="noopener noreferrer" style={{ color: green, fontWeight: 700 }}>View live post ↗</a></div>
        </div>) : <p style={{ color: muted }}>No live {requestType ? 'wanted requests' : 'offers'} in this category right now.</p>}
        <a href="/revlongbm?tab=posts" style={{ color: green, fontWeight: 700 }}>Browse all posts in admin →</a>
      </div>
    </div>
  </section>;
}

function choice(active) {
  return { border: `1px solid ${active ? green : border}`, background: active ? '#e9f4e9' : '#fff', color: active ? green : '#667085', borderRadius: 8, padding: '9px 13px', fontWeight: 700, cursor: 'pointer' };
}

function action(primary) {
  return { display: 'inline-block', padding: '9px 13px', border: `1px solid ${green}`, background: primary ? green : '#fffdf6', color: primary ? '#fff' : green, borderRadius: 7, fontSize: 13, fontWeight: 800 };
}
