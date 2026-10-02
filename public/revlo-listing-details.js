(() => {
  'use strict';
  // Listing details (2026-10-02). Additive: optional fields in the post form.
  // - For Sale: price (₦) and condition -> "Price: ₦85,000 · Used"
  // - Promotions: event date, times and venue -> "When: Sat 12 Oct 2026, 7:00 pm – 11:00 pm" / "Where: …"
  // They are added to the end of the post's description when it is published, so readers see them
  // and the post page can describe the item or event to Google (src/lib/listingMarkup.mjs).
  // The form's own code is unchanged; this only adds to the description it sends.

  const state = { price: '', condition: '', date: '', start: '', end: '', venue: '' };
  const style = document.createElement('style');
  style.textContent = `
    .rv-ld{margin:10px 0 4px;padding:12px;border:1.5px dashed #c8d8c9;border-radius:14px;background:#f6faf6;display:grid;gap:10px}
    .rv-ld[hidden]{display:none}
    .rv-ld-title{font:800 13px/1.2 system-ui;color:#1b5e20}
    .rv-ld-note{font:12px/1.4 system-ui;color:#6b6b6b;margin:0}
    .rv-ld-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
    .rv-ld label{display:grid;gap:4px;font:700 12px system-ui;color:#3d3d3d}
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
          init = { ...init, body: JSON.stringify(body) };
        }
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
    const note = document.createElement('p');
    note.className = 'rv-ld-note';
    note.textContent = 'Shown at the end of your post, and helps it appear in Google search.';
    panel.append(sale, event, note);
    return panel;
  }

  function sync() {
    const details = document.querySelector('textarea[aria-label="Details"]');
    if (!details) return;
    let panel = document.querySelector('.rv-ld');
    if (!panel) { panel = build(); details.insertAdjacentElement('afterend', panel); }
    const category = categoryNow();
    panel.hidden = category !== 'for_sale' && category !== 'promotions';
    panel.querySelector('.rv-ld-sale').hidden = category !== 'for_sale';
    panel.querySelector('.rv-ld-event').hidden = category !== 'promotions';
  }

  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; sync(); }, 80); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('change', e => { if (e.target instanceof HTMLSelectElement) sync(); });
})();
