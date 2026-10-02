(() => {
  'use strict';
  // Book a viewing or call (2026-10-02). Additive script:
  // - Cards of Rentals / For Sale posts that take bookings get "📅 Book a viewing" (or "📞 Book a call").
  // - The booking sheet lists free times (Lagos time); the visitor gives name, phone and email and
  //   confirms by email; the poster accepts or declines by email. Safety notices throughout.
  // - Rentals details become badges on cards ("2 bedrooms · ₦1.5m/year · Serviced") and a filter bar
  //   (type and maximum rent) appears under Rentals.
  // - Hero: a "Book a viewing" call to action and a "Viewings booked online" chip.
  // - ?book=UID opens the sheet (links from emails and post pages); ?booking=… shows the outcome.

  const SAFETY = [
    'Never pay anything (no “inspection fee”, deposit or transfer) before you have seen the place or item in person.',
    'Meet in daylight, in a busy place, and take someone with you to viewings.',
    'Check documents and ownership before paying. Never share bank PINs or codes.',
  ];
  const PROPERTY = { room: 'Room', self_contain: 'Self-contain', '1_bed': '1 bedroom', '2_bed': '2 bedrooms', '3_bed': '3 bedrooms', '4_bed': '4+ bedrooms', shop: 'Shop', office: 'Office' };
  const FURNISH = { furnished: 'Furnished', unfurnished: 'Unfurnished', serviced: 'Serviced' };
  const LABELS = { All: 'all', Jobs: 'jobs', Rentals: 'rentals', 'For Sale': 'for_sale', Promotions: 'promotions', General: 'general' };
  const extras = { booking: {}, details: {} };
  const asked = new Set();
  let category = 'all';
  const filter = { property: '', maxRent: '' };

  const style = document.createElement('style');
  style.textContent = `
    .rv-bk-btn{background:#fff7e6;color:#92400e;border:1.5px solid #b45309;border-radius:12px;padding:9px 14px;font:800 14.5px system-ui;cursor:pointer}
    .rv-bk-btn:hover{background:#b45309;color:#fff}
    article[data-rv-bk-hidden]{display:none!important}
    .rv-bk-badges{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
    .rv-bk-badges span{background:#eef6ef;color:#1b5e20;border-radius:999px;padding:4px 9px;font:700 12.5px system-ui}
    .rv-bk-filter{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 16px;padding:10px 12px;border:1.5px solid #e3e3e3;border-radius:14px;background:#fff;font:700 13px system-ui;color:#333}
    .rv-bk-filter select{font:14px system-ui;padding:7px 9px;border:1.5px solid #d6d6d6;border-radius:10px;background:#fff}
    .rv-bk-dialog{position:fixed;inset:0;z-index:2147480001;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
    @media (min-width:640px){.rv-bk-dialog{align-items:center}}
    .rv-bk-sheet{width:min(520px,100%);max-height:92vh;overflow:auto;background:#fffdf7;border-radius:20px 20px 0 0;padding:20px 18px 22px;box-sizing:border-box;box-shadow:0 -10px 40px rgba(0,0,0,.25)}
    @media (min-width:640px){.rv-bk-sheet{border-radius:20px}}
    .rv-bk-sheet h3{margin:0 0 2px;font:900 21px/1.2 Georgia,serif;color:#1b5e20}
    .rv-bk-sub{margin:0 0 12px;font:13.5px/1.4 system-ui;color:#666}
    .rv-bk-close{float:right;border:0;background:#eee;border-radius:999px;width:34px;height:34px;font-size:18px;cursor:pointer}
    .rv-bk-seg{display:flex;gap:6px;margin:0 0 12px}
    .rv-bk-seg button,.rv-bk-day,.rv-bk-slot{border:1.5px solid #d6d6d6;background:#fff;border-radius:10px;padding:8px 11px;font:700 13.5px system-ui;cursor:pointer;color:#1a1a1a}
    .rv-bk-seg button[aria-pressed="true"],.rv-bk-day[aria-pressed="true"],.rv-bk-slot[aria-pressed="true"]{background:#1b5e20;border-color:#1b5e20;color:#fff}
    .rv-bk-days{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin:0 0 10px}
    .rv-bk-day{flex:none;text-align:center;line-height:1.2}
    .rv-bk-day small{display:block;font-weight:600;opacity:.8}
    .rv-bk-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:6px;margin:0 0 14px}
    .rv-bk-form{display:grid;gap:9px}
    .rv-bk-form label{display:grid;gap:4px;font:700 12.5px system-ui;color:#333}
    .rv-bk-form input{font:15px system-ui;padding:10px 11px;border:1.5px solid #d6d6d6;border-radius:10px;background:#fff;width:100%;box-sizing:border-box}
    .rv-bk-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}
    .rv-bk-go{border:0;border-radius:12px;background:#1b5e20;color:#fff;font:800 15px system-ui;padding:12px 16px;cursor:pointer}
    .rv-bk-go:disabled{opacity:.6}
    .rv-bk-msg{margin:4px 0 0;font:700 14px/1.4 system-ui;color:#1b5e20}.rv-bk-msg.err{color:#b42318}
    .rv-bk-safe{margin:14px 0 0;padding:11px 13px;border-radius:12px;background:#fff7e6;border:1px solid #f3dfb0;font:13px/1.45 system-ui;color:#3d2a00}
    .rv-bk-safe ul{margin:5px 0 0;padding-left:18px}
    .rv-bk-cta{display:inline-flex;align-items:center;gap:8px;margin-left:10px;border:1.5px solid #1b5e20;background:#fff;color:#1b5e20;border-radius:12px;padding:14px 18px;font:800 16px system-ui;cursor:pointer;vertical-align:middle}
    .rv-bk-cta:hover{background:#eef6ef}
    @media (max-width:560px){.rv-bk-cta{margin:10px 0 0;width:100%;justify-content:center}}
    .rv-bk-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147480002;background:#1b5e20;color:#fff;border-radius:12px;padding:12px 16px;font:700 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:calc(100vw - 32px)}
  `;
  document.head.appendChild(style);

  const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text != null) e.textContent = text; return e; };
  const money = n => (n >= 1e6 ? `₦${+(n / 1e6).toFixed(2)}m` : n >= 1e3 ? `₦${Math.round(n / 1e3)}k` : `₦${n}`);
  const lagos = iso => new Date(new Date(iso).getTime() + 3600000);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const timeLabel = iso => { const d = lagos(iso); const h = d.getUTCHours(); return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
  const dayKey = iso => lagos(iso).toISOString().slice(0, 10);

  function toast(text) { const t = el('div', 'rv-bk-toast', text); t.setAttribute('role', 'status'); document.body.appendChild(t); setTimeout(() => t.remove(), 7000); }

  function safetyBox() {
    const box = el('div', 'rv-bk-safe');
    box.append(el('strong', '', 'Stay safe'));
    const ul = el('ul'); SAFETY.forEach(line => ul.appendChild(el('li', '', line))); box.appendChild(ul);
    return box;
  }

  async function openBooking(uid, sample) {
    if (document.querySelector('.rv-bk-dialog')) return;
    const dialog = el('div', 'rv-bk-dialog');
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', 'Book a viewing or call');
    const sheet = el('div', 'rv-bk-sheet');
    const closeBtn = el('button', 'rv-bk-close', '×'); closeBtn.type = 'button'; closeBtn.setAttribute('aria-label', 'Close');
    sheet.append(closeBtn, el('h3', '', 'Book a viewing or call'));
    const sub = el('p', 'rv-bk-sub', 'Loading free times…'); sheet.appendChild(sub);
    dialog.appendChild(sheet); document.body.appendChild(dialog);
    const close = () => { dialog.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    closeBtn.addEventListener('click', close); dialog.addEventListener('click', e => { if (e.target === dialog) close(); }); document.addEventListener('keydown', onKey);
    if (sample) { sub.textContent = 'This is an example post. On real Rentals and For Sale posts you pick a free time here, and the poster confirms by email.'; sheet.appendChild(safetyBox()); return; }

    let data;
    try { const r = await fetch(`/api/bookings/slots?uid=${encodeURIComponent(uid)}`, { cache: 'no-store' }); data = await r.json(); if (!r.ok) throw new Error(data.error); }
    catch (error) { sub.textContent = error.message || 'Could not load times. Please try again.'; return; }
    sub.textContent = `${data.title}${data.location ? ` · ${data.location}` : ''}`;
    if (!data.slots.length) { sheet.append(el('p', 'rv-bk-msg err', 'No free times left for this post. Try Contact instead.'), safetyBox()); return; }

    const choice = { mode: data.modes.includes('viewing') ? 'viewing' : 'call', slot: null };
    const seg = el('div', 'rv-bk-seg');
    data.modes.forEach(mode => { const b = el('button', '', mode === 'viewing' ? '🏠 Viewing' : '📞 Call'); b.type = 'button'; b.setAttribute('aria-pressed', String(choice.mode === mode)); b.addEventListener('click', () => { choice.mode = mode; seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }); seg.appendChild(b); });
    if (data.modes.length > 1) sheet.appendChild(seg);
    const byDay = new Map(); data.slots.forEach(s => { const k = dayKey(s); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(s); });
    const days = el('div', 'rv-bk-days'); const slots = el('div', 'rv-bk-slots');
    const showDay = key => {
      days.querySelectorAll('.rv-bk-day').forEach(d => d.setAttribute('aria-pressed', String(d.dataset.key === key)));
      slots.textContent = '';
      byDay.get(key).forEach(s => { const b = el('button', 'rv-bk-slot', timeLabel(s)); b.type = 'button'; b.setAttribute('aria-pressed', String(choice.slot === s)); b.addEventListener('click', () => { choice.slot = s; slots.querySelectorAll('.rv-bk-slot').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }); slots.appendChild(b); });
    };
    [...byDay.keys()].forEach(key => { const d = lagos(byDay.get(key)[0]); const b = el('button', 'rv-bk-day'); b.type = 'button'; b.dataset.key = key; b.append(DAYS[d.getUTCDay()], el('small', '', `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`)); b.addEventListener('click', () => showDay(key)); days.appendChild(b); });
    sheet.append(el('div', 'rv-bk-sub', 'Pick a day and time (Lagos time)'), days, slots);
    showDay(byDay.keys().next().value);

    const form = el('form', 'rv-bk-form'); form.noValidate = true;
    form.innerHTML = '<div class="rv-bk-row"><label>Your name<input name="name" autocomplete="name" maxlength="80"></label><label>Phone<input name="phone" type="tel" autocomplete="tel" placeholder="0803 123 4567"></label></div><label>Email (to confirm)<input name="email" type="email" autocomplete="email"></label><label>Note (optional)<input name="note" maxlength="300" placeholder="e.g. Is parking available?"></label><button class="rv-bk-go" type="submit">Request this time</button><p class="rv-bk-msg" role="status" aria-live="polite"></p><p class="rv-bk-sub" style="margin:0">After you confirm by email, the poster gets your name, phone and email and accepts or declines.</p>';
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const msg = form.querySelector('.rv-bk-msg'); const go = form.querySelector('.rv-bk-go'); msg.className = 'rv-bk-msg';
      if (!choice.slot) { msg.classList.add('err'); msg.textContent = 'Pick a time first.'; return; }
      go.disabled = true; msg.textContent = 'Sending…';
      try {
        const r = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, mode: choice.mode, slot: choice.slot, name: form.name.value, phone: form.phone.value, email: form.email.value, note: form.note.value }) });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
        const address = form.email.value.trim();
        [seg, days, slots].forEach(x => x.remove()); form.querySelectorAll('label, .rv-bk-row, .rv-bk-go, .rv-bk-sub').forEach(x => x.remove());
        msg.textContent = `Almost done: check ${address} and tap the link to send your request.`;
      } catch (error) { msg.classList.add('err'); msg.textContent = error.message; go.disabled = false; }
    });
    sheet.append(form, safetyBox());
  }

  // Cards: booking buttons, rental badges and the Rentals filter.
  async function fetchExtras() {
    const uids = [...document.querySelectorAll('article[id^="post-"]:not([data-sample])')].map(a => a.id.slice(5)).filter(u => !asked.has(u));
    if (!uids.length) return;
    uids.forEach(u => asked.add(u));
    try {
      const r = await fetch(`/api/listing-extras?uids=${encodeURIComponent(uids.slice(0, 100).join(','))}`);
      if (!r.ok) return;
      const body = await r.json();
      Object.assign(extras.booking, body.booking || {}); Object.assign(extras.details, body.details || {});
      decorate();
    } catch { /* cards work without extras */ }
  }

  function badges(details) {
    const out = [];
    if (details.property) out.push(PROPERTY[details.property]);
    if (details.rent) out.push(`${money(details.rent)}/${details.rent_period || 'year'}`);
    if (details.bathrooms) out.push(`${details.bathrooms} bath`);
    if (details.furnishing) out.push(FURNISH[details.furnishing]);
    if (details.price) out.push(money(details.price));
    if (details.condition) out.push(details.condition);
    return out.filter(Boolean);
  }

  function decorate() {
    document.querySelectorAll('article[id^="post-"]').forEach(article => {
      const sample = article.dataset.sample === 'true';
      const uid = article.id.slice(5);
      const contact = [...article.querySelectorAll('button, a')].find(b => /Contact/.test(b.textContent));
      const cardCategory = article.querySelector('span')?.textContent.trim().toLowerCase();
      const modes = sample ? (['rentals', 'for sale'].includes(cardCategory) ? ['viewing'] : null) : extras.booking[uid];
      if (modes && contact && !article.querySelector('.rv-bk-btn')) {
        const b = el('button', 'rv-bk-btn', modes.includes('viewing') ? '📅 Book a viewing' : '📞 Book a call'); b.type = 'button';
        b.addEventListener('click', e => { e.stopPropagation(); openBooking(uid, sample); });
        contact.insertAdjacentElement('afterend', b);
      }
      const details = extras.details[uid];
      if (details && !article.querySelector('.rv-bk-badges')) {
        const row = el('div', 'rv-bk-badges'); badges(details).forEach(t => row.appendChild(el('span', '', t)));
        const meta = article.querySelector('.revlo-theme-muted-text');
        if (meta && row.children.length) meta.insertAdjacentElement('afterend', row);
      }
      // Rentals filter: hide cards that do not match (cards without details are hidden only while a filter is set).
      const d = details || {};
      const hide = category === 'rentals' && ((filter.property && d.property !== filter.property) || (filter.maxRent && !(d.rent && d.rent <= Number(filter.maxRent))));
      if (hide) article.dataset.rvBkHidden = '1'; else delete article.dataset.rvBkHidden;
    });
    filterBar();
  }

  function filterBar() {
    const first = document.querySelector('article[id^="post-"]');
    let bar = document.querySelector('.rv-bk-filter');
    if (category !== 'rentals' || !first) { bar?.remove(); return; }
    if (!bar) {
      bar = el('div', 'rv-bk-filter');
      bar.append('Filter rentals:');
      const type = el('select'); type.setAttribute('aria-label', 'Type'); type.add(new Option('Any type', '')); Object.entries(PROPERTY).forEach(([v, t]) => type.add(new Option(t, v))); type.value = filter.property;
      const rent = el('select'); rent.setAttribute('aria-label', 'Maximum rent'); rent.add(new Option('Any rent', '')); [300000, 500000, 1000000, 1500000, 2500000, 5000000].forEach(n => rent.add(new Option(`Up to ${money(n)}`, String(n)))); rent.value = filter.maxRent;
      type.addEventListener('change', () => { filter.property = type.value; decorate(); });
      rent.addEventListener('change', () => { filter.maxRent = rent.value; decorate(); });
      bar.append(type, rent);
    }
    const list = first.parentElement;
    if (bar.nextElementSibling !== list) list.insertAdjacentElement('beforebegin', bar);
  }

  // Hero: call to action and chip.
  function hero() {
    const post = [...document.querySelectorAll('button')].find(b => /Post something/.test(b.textContent) && b.offsetParent !== null);
    if (post && !document.querySelector('.rv-bk-cta')) {
      const cta = el('button', 'rv-bk-cta', '📅 Book a viewing'); cta.type = 'button';
      cta.addEventListener('click', () => {
        const rentals = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Rentals' && b.offsetParent !== null);
        category = 'rentals'; rentals?.click();
        setTimeout(() => (document.querySelector('.rv-bk-filter') || document.querySelector('article[id^="post-"]'))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
      });
      post.insertAdjacentElement('afterend', cta);
    }
    // The hero's feature chips are spans with an emoji and a label; add one after "No comments or debates".
    const pill = [...document.querySelectorAll('#revlo-header-details span.revlo-theme-muted-surface')].find(e => /No comments or debates/.test(e.textContent));
    if (pill && !pill.parentElement.querySelector('.rv-bk-chip')) {
      const copy = pill.cloneNode(false); copy.classList.add('rv-bk-chip');
      const icon = el('span', '', '📅'); icon.setAttribute('aria-hidden', 'true');
      copy.append(icon, 'Viewings booked online');
      pill.insertAdjacentElement('afterend', copy);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    const key = button && LABELS[button.textContent.trim()];
    if (key && event.isTrusted && !button.closest('.rv-pf, [role="radiogroup"]')) { category = key; setTimeout(decorate, 300); }
  }, true);

  const params = new URLSearchParams(location.search);
  const outcome = params.get('booking');
  if (outcome) {
    const text = { sent: '📅 Request sent. The poster will accept or decline by email.', taken: 'Sorry, someone confirmed that time first. Please pick another.', done: 'This request was already confirmed.', past: 'That time has passed. Please pick another.', invalid: 'That booking link is not valid.' }[outcome];
    if (text) setTimeout(() => toast(text), 1200);
  }
  const bookUid = params.get('book');
  if (outcome || bookUid) { const url = new URL(location.href); url.searchParams.delete('booking'); url.searchParams.delete('book'); history.replaceState(null, '', url); }
  if (bookUid && /^[A-Za-z0-9-]{4,24}$/.test(bookUid)) setTimeout(() => openBooking(bookUid, false), 1500);

  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; hero(); decorate(); fetchExtras(); }, 150); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
