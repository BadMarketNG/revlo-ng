(() => {
  'use strict';
  // Listing details (2026-10-02). Additive: optional fields in the post form.
  // - For Sale: price (₦) and condition -> "Price: ₦85,000 · Used"
  // - Promotions: event date, times and venue -> "When: Sat 12 Oct 2026, 7:00 pm – 11:00 pm" / "Where: …"
  // They are added to the end of the post's description when it is published, so readers see them
  // and the post page can describe the item or event to Google (src/lib/listingMarkup.mjs).
  // The form's own code is unchanged; this only adds to the description it sends.
  // 2026-10-02 (later): Rentals details (rent, rooms, bathrooms, furnishing) and "Let people book a
  // viewing or call" (days, hours, slot length) for Rentals and For Sale. These are also sent as
  // structured fields (body.details, body.booking), which the server saves for filters and bookings.

  const state = { price: '', condition: '', date: '', start: '', end: '', venue: '', rent: '', rent_period: 'year', property: '', bathrooms: '', furnishing: '',
    book: true, book_viewing: true, book_call: true, book_days: [1, 2, 3, 4, 5, 6], book_from: '10:00', book_to: '17:00', book_slot: '30' };
  const PROPERTY = { room: 'Room in a shared flat', self_contain: 'Self-contain', '1_bed': '1 bedroom', '2_bed': '2 bedrooms', '3_bed': '3 bedrooms', '4_bed': '4+ bedrooms', shop: 'Shop', office: 'Office space' };
  const FURNISH = { furnished: 'Furnished', unfurnished: 'Unfurnished', serviced: 'Serviced' };
  const style = document.createElement('style');
  style.textContent = `
    .rv-ld{margin:10px 0 4px;padding:12px;border:1.5px dashed #c8d8c9;border-radius:14px;background:#f6faf6;display:grid;gap:10px}
    .rv-ld[hidden]{display:none}
    .rv-ld-title{font:800 13px/1.2 system-ui;color:#1b5e20}
    .rv-ld-note{font:12px/1.4 system-ui;color:#6b6b6b;margin:0}
    .rv-ld-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
    .rv-ld label{display:grid;gap:4px;font:700 12px system-ui;color:#3d3d3d}
    .rv-ld-days{display:flex;flex-wrap:wrap;gap:6px}
    .rv-ld-days label{display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid #d6d6d6;border-radius:999px;background:#fff;font:700 12.5px system-ui;cursor:pointer}
    .rv-ld-days input{width:auto;padding:0}
    .rv-ld-toggle{display:flex!important;grid-template-columns:none!important;align-items:center;gap:8px!important;font:800 13px system-ui!important;color:#1b5e20!important}
    .rv-ld-toggle input{width:auto}
    .rv-ld input,.rv-ld select{font:15px system-ui;padding:9px 10px;border:1.5px solid #d6d6d6;border-radius:10px;background:#fff;color:#1a1a1a;min-width:0;width:100%;box-sizing:border-box}
  `;
  document.head.appendChild(style);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const time12 = value => { const [h, m] = value.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };

  function categoryNow() {
    const select = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'for_sale'));
    return select?.value || '';
  }

  /** The block appended to the description for the chosen category (empty when nothing was filled in). */
  function block(category) {
    if (category === 'rentals') {
      const rent = Number(String(state.rent).replace(/[^\d.]/g, ''));
      const parts = [rent > 0 ? `Rent: ₦${rent.toLocaleString('en-NG', { maximumFractionDigits: 0 })} per ${state.rent_period}` : null,
        PROPERTY[state.property] || null, Number(state.bathrooms) > 0 ? `${Number(state.bathrooms)} bathroom${Number(state.bathrooms) > 1 ? 's' : ''}` : null, FURNISH[state.furnishing] || null].filter(Boolean);
      return parts.length ? `\n\n${parts.join(' · ')}` : '';
    }
    if (category === 'for_sale') {
      const price = Number(String(state.price).replace(/[^\d.]/g, ''));
      if (!(price > 0)) return '';
      return `\n\nPrice: ₦${price.toLocaleString('en-NG', { maximumFractionDigits: 2 })}${state.condition ? ` · ${state.condition}` : ''}`;
    }
    if (category === 'promotions' && state.date && state.start && state.venue.trim()) {
      const [y, mo, d] = state.date.split('-').map(Number);
      const day = DAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
      const times = `${time12(state.start)}${state.end ? ` – ${time12(state.end)}` : ''}`;
      return `\n\nWhen: ${day} ${d} ${MONTHS[mo - 1]} ${y}, ${times}\nWhere: ${state.venue.trim().replace(/\s+/g, ' ').slice(0, 160)}`;
    }
    return '';
  }

  function structured(category) {
    if (category === 'rentals') return { rent: state.rent, rent_period: state.rent_period, property: state.property || undefined, bathrooms: state.bathrooms || undefined, furnishing: state.furnishing || undefined };
    if (category === 'for_sale') return { price: state.price, condition: state.condition || undefined };
    return null;
  }

  // Adds the block to the description when the form publishes (the form posts JSON to /api/posts).
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && /\/api\/posts$/.test(url.split('?')[0]) && init?.method === 'POST' && typeof init.body === 'string') {
        const body = JSON.parse(init.body);
        const extra = block(body.category);
        if (extra && !String(body.description || '').includes(extra.trim())) {
          body.description = `${String(body.description || '').trimEnd()}${extra}`.slice(0, 5000);
        }
        const details = structured(body.category);
        if (details) body.details = details;
        if (state.book && (body.category === 'rentals' || body.category === 'for_sale')) {
          body.booking = { modes: [state.book_viewing && 'viewing', state.book_call && 'call'].filter(Boolean), days: state.book_days, start_time: state.book_from, end_time: state.book_to, slot_minutes: Number(state.book_slot) };
        }
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch { /* send the form unchanged */ }
    return nativeFetch(input, init);
  };

  function field(label, input) { const l = document.createElement('label'); l.append(label, input); return l; }
  function input(type, key, attrs = {}) {
    const el = document.createElement(type === 'select' ? 'select' : 'input');
    if (type !== 'select') el.type = type;
    Object.assign(el, attrs);
    el.value = state[key];
    el.addEventListener('input', () => { state[key] = el.value; });
    el.addEventListener('change', () => { state[key] = el.value; });
    return el;
  }

  function build() {
    const panel = document.createElement('div');
    panel.className = 'rv-ld';
    const sale = document.createElement('div');
    sale.className = 'rv-ld-sale';
    const condition = input('select', 'condition');
    [['', 'Condition (optional)'], ['Brand new', 'Brand new'], ['Used', 'Used'], ['Refurbished', 'Refurbished']].forEach(([v, t]) => condition.add(new Option(t, v)));
    sale.innerHTML = '<div class="rv-ld-title">Price (optional)</div>';
    const saleRow = document.createElement('div'); saleRow.className = 'rv-ld-row';
    saleRow.append(field('Price in ₦', input('text', 'price', { inputMode: 'numeric', placeholder: 'e.g. 85000' })), field('Condition', condition));
    sale.append(saleRow);
    const event = document.createElement('div');
    event.className = 'rv-ld-event';
    event.innerHTML = '<div class="rv-ld-title">Is this an event? (optional)</div>';
    const eventRow = document.createElement('div'); eventRow.className = 'rv-ld-row';
    eventRow.append(field('Date', input('date', 'date')), field('Starts', input('time', 'start')), field('Ends', input('time', 'end')));
    event.append(eventRow, field('Venue and area', input('text', 'venue', { placeholder: 'e.g. Freedom Park, Lagos Island', maxLength: 160 })));
    // Rentals details.
    const rental = document.createElement('div');
    rental.className = 'rv-ld-rental';
    rental.innerHTML = '<div class="rv-ld-title">Rental details (optional)</div>';
    const period = input('select', 'rent_period'); [['year', 'per year'], ['month', 'per month'], ['night', 'per night']].forEach(([v, t]) => period.add(new Option(t, v))); period.value = state.rent_period;
    const property = input('select', 'property'); property.add(new Option('Choose…', '')); Object.entries(PROPERTY).forEach(([v, t]) => property.add(new Option(t, v)));
    const furnishing = input('select', 'furnishing'); furnishing.add(new Option('Choose…', '')); Object.entries(FURNISH).forEach(([v, t]) => furnishing.add(new Option(t, v)));
    const rRow1 = document.createElement('div'); rRow1.className = 'rv-ld-row';
    rRow1.append(field('Rent in ₦', input('text', 'rent', { inputMode: 'numeric', placeholder: 'e.g. 1500000' })), field('Paid', period));
    const rRow2 = document.createElement('div'); rRow2.className = 'rv-ld-row';
    rRow2.append(field('Type', property), field('Bathrooms', input('text', 'bathrooms', { inputMode: 'numeric', placeholder: 'e.g. 2' })), field('Furnishing', furnishing));
    rental.append(rRow1, rRow2);
    // Booking availability (Rentals and For Sale).
    const booking = document.createElement('div');
    booking.className = 'rv-ld-booking';
    const toggle = document.createElement('label'); toggle.className = 'rv-ld-toggle';
    const on = document.createElement('input'); on.type = 'checkbox'; on.checked = state.book;
    toggle.append(on, '📅 Let people book a viewing or call');
    const opts = document.createElement('div'); opts.style.display = 'grid'; opts.style.gap = '10px';
    const modes = document.createElement('div'); modes.className = 'rv-ld-days';
    [['book_viewing', 'Viewings'], ['book_call', 'Calls']].forEach(([key, text]) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = state[key]; c.addEventListener('change', () => { state[key] = c.checked; }); l.append(c, text); modes.appendChild(l); });
    const days = document.createElement('div'); days.className = 'rv-ld-days';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((d, i) => { const l = document.createElement('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = state.book_days.includes(i); c.addEventListener('change', () => { state.book_days = c.checked ? [...state.book_days, i].sort() : state.book_days.filter(x => x !== i); }); l.append(c, d); days.appendChild(l); });
    const slot = input('select', 'book_slot'); [['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour']].forEach(([v, t]) => slot.add(new Option(t, v))); slot.value = state.book_slot;
    const hours = document.createElement('div'); hours.className = 'rv-ld-row';
    hours.append(field('From', input('time', 'book_from')), field('To', input('time', 'book_to')), field('Each booking', slot));
    const bNote = document.createElement('p'); bNote.className = 'rv-ld-note';
    bNote.textContent = 'Visitors pick a free time (Lagos time) and confirm by email. You get their name and phone and accept or decline. Your email stays hidden.';
    opts.append(modes, days, hours, bNote);
    on.addEventListener('change', () => { state.book = on.checked; opts.hidden = !on.checked; });
    booking.append(toggle, opts);
    const note = document.createElement('p');
    note.className = 'rv-ld-note';
    note.textContent = 'Details are shown at the end of your post, and help it appear in Google search.';
    panel.append(rental, sale, event, booking, note);
    return panel;
  }

  function sync() {
    const details = document.querySelector('textarea[aria-label="Details"]');
    if (!details) return;
    let panel = document.querySelector('.rv-ld');
    if (!panel) { panel = build(); details.insertAdjacentElement('afterend', panel); }
    const category = categoryNow();
    panel.hidden = !['for_sale', 'promotions', 'rentals'].includes(category);
    panel.querySelector('.rv-ld-sale').hidden = category !== 'for_sale';
    panel.querySelector('.rv-ld-rental').hidden = category !== 'rentals';
    panel.querySelector('.rv-ld-booking').hidden = category !== 'rentals' && category !== 'for_sale';
    panel.querySelector('.rv-ld-event').hidden = category !== 'promotions';
  }

  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; sync(); }, 80); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('change', e => { if (e.target instanceof HTMLSelectElement) sync(); });
})();
