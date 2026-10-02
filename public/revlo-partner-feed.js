(() => {
  'use strict';
  // Partner feed (2026-10-02). Additive: shows outside listings and headlines as Revlo cards under
  // the posts of the selected category. A card opens a Revlo view; only "Open on <source>" leaves
  // Revlo. Every card names its source, as the providers' terms require.

  const LABELS = { All: 'all', Jobs: 'jobs', Rentals: 'rentals', 'For Sale': 'for_sale', Promotions: 'promotions', General: 'general' };
  const KIND = { news: 'NEWS', job: 'JOB', listing: 'LISTING', offer: 'OFFER' };
  let category = 'all';
  let query = '';
  const cache = new Map();

  const style = document.createElement('style');
  style.textContent = `
    .rv-pf{max-width:680px;margin:28px auto 8px;padding:0 0 8px;box-sizing:border-box}
    .rv-pf-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 2px 12px}
    .rv-pf-head h2{margin:0;font:900 20px/1.1 Georgia,serif;color:#1b5e20}
    .rv-pf-head span{font:12px system-ui;color:#7b867c}
    .rv-pf-list{display:grid;gap:12px}
    .rv-pf-card{display:grid;grid-template-columns:168px minmax(0,1fr);gap:16px;align-items:center;width:100%;text-align:left;border:1.5px solid #e3e3e3;background:#fff;border-radius:16px;padding:12px;cursor:pointer;font:inherit;color:inherit;transition:border-color .2s,transform .2s}
    .rv-pf-thumb{position:relative;width:100%;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:#1b5e20;display:grid;place-items:center}
    .rv-pf-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .rv-pf-thumb span{font:900 26px/1 Georgia,serif;color:#eef6ef;letter-spacing:.02em}
    .rv-pf-body{min-width:0;padding-right:4px}
    @media (max-width:560px){.rv-pf-card{grid-template-columns:104px minmax(0,1fr);gap:12px;padding:10px}.rv-pf-title{font-size:15px!important}}
    .rv-pf-hero{position:relative;margin:-22px -20px 14px;aspect-ratio:16/9;overflow:hidden;border-radius:20px 20px 0 0;background:#1b5e20}
    .rv-pf-hero img{width:100%;height:100%;object-fit:cover;display:block}
    .rv-pf-card:hover{border-color:#1b5e20;transform:translateY(-1px)}
    .rv-pf-kind{display:inline-block;font:800 10.5px/1 system-ui;letter-spacing:.08em;color:#1b5e20;background:#eef6ef;border-radius:999px;padding:5px 8px}
    .rv-pf-title{display:block;margin:8px 0 6px;font:800 17px/1.3 system-ui;color:#1a1a1a}
    .rv-pf-meta{font:13px system-ui;color:#6b6b6b}
    .rv-pf-meta b{color:#1b5e20;font-weight:700}
    .rv-pf-dialog{position:fixed;inset:0;z-index:2147480000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
    @media (min-width:640px){.rv-pf-dialog{align-items:center}}
    .rv-pf-sheet{width:min(560px,100%);background:#fffdf7;border-radius:20px 20px 0 0;padding:22px 20px 26px;box-shadow:0 -10px 40px rgba(0,0,0,.25)}
    @media (min-width:640px){.rv-pf-sheet{border-radius:20px}}
    .rv-pf-sheet h3{margin:10px 0 8px;font:900 22px/1.25 Georgia,serif;color:#1a1a1a}
    .rv-pf-out{display:inline-flex;align-items:center;gap:8px;margin-top:16px;background:#1b5e20;color:#fff;border-radius:12px;padding:12px 16px;font:700 15px system-ui;text-decoration:none}
    .rv-pf-close{float:right;border:0;background:#eee;border-radius:999px;width:34px;height:34px;font-size:18px;cursor:pointer}
    .rv-pf-note{margin-top:10px;font:12.5px system-ui;color:#7b867c}
  `;
  document.head.appendChild(style);

  const ago = iso => {
    const t = Date.parse(iso);
    if (!t) return '';
    const m = Math.max(1, Math.round((Date.now() - t) / 60000));
    return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
  };
  const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

  const initials = name => String(name || 'Job').split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  // Publisher's image, loaded from their server; a branded placeholder if it is missing or fails.
  function thumb(item, className) {
    const box = document.createElement('span');
    box.className = className;
    const fallback = () => { box.textContent = ''; const mark = document.createElement('span'); mark.textContent = initials(item.source || item.company); box.appendChild(mark); };
    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', fallback, { once: true });
      box.appendChild(img);
    } else fallback();
    return box;
  }

  function openItem(item) {
    const dialog = document.createElement('div');
    dialog.className = 'rv-pf-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = '<div class="rv-pf-sheet"><button type="button" class="rv-pf-close" aria-label="Close">×</button><span class="rv-pf-kind"></span><h3></h3><div class="rv-pf-meta"></div><a class="rv-pf-out" target="_blank" rel="noopener noreferrer"></a><p class="rv-pf-note"></p></div>';
    const sheet = dialog.firstChild;
    if (item.image) sheet.insertBefore(thumb(item, 'rv-pf-hero'), sheet.firstChild);
    sheet.querySelector('.rv-pf-kind').textContent = KIND[item.kind] || 'PARTNER';
    sheet.querySelector('h3').textContent = item.title;
    sheet.querySelector('.rv-pf-meta').textContent = [item.source ? `via ${item.source}` : item.company, item.location, item.salary, ago(item.publishedAt)].filter(Boolean).join(' · ');
    const out = sheet.querySelector('.rv-pf-out');
    out.href = item.url;
    // Some sources are confidential (no source name): the button and note then stay generic.
    out.textContent = item.source ? `Open on ${item.source} ↗` : 'Open the full listing ↗';
    sheet.querySelector('.rv-pf-note').textContent = item.source ? `This opens ${host(item.url)} in a new tab. It is not a Revlo post.` : 'This opens on an outside site in a new tab. It is not a Revlo post.';
    const close = () => { dialog.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
    sheet.querySelector('.rv-pf-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(dialog);
    out.focus();
  }

  function container() {
    const firstPost = document.querySelector('article[id^="post-"], article[data-sample]');
    const list = firstPost?.parentElement;
    if (!list || !list.parentElement) return null;
    let section = document.querySelector('.rv-pf');
    if (!section) {
      section = document.createElement('section');
      section.className = 'rv-pf';
      section.setAttribute('aria-label', 'From around Nigeria');
      section.innerHTML = '<div class="rv-pf-head"><h2>Around Nigeria</h2><span>From partner sites · opens on the source</span></div><div class="rv-pf-list"></div>';
    }
    if (section.previousElementSibling !== list) list.insertAdjacentElement('afterend', section);
    return section;
  }

  function render() {
    const section = container();
    if (!section) return;
    const items = (cache.get(category) || []).filter(item => !query || `${item.title} ${item.source} ${item.location || ''}`.toLowerCase().includes(query));
    section.hidden = items.length === 0;
    const list = section.querySelector('.rv-pf-list');
    const key = `${category}|${query}|${items.length}`;
    if (list.dataset.key === key) return;
    list.dataset.key = key;
    list.textContent = '';
    for (const item of items.slice(0, 30)) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'rv-pf-card';
      card.innerHTML = '<span class="rv-pf-body"><span class="rv-pf-kind"></span><span class="rv-pf-title"></span><span class="rv-pf-meta"></span></span>';
      card.insertBefore(thumb(item, 'rv-pf-thumb'), card.firstChild);
      card.querySelector('.rv-pf-kind').textContent = KIND[item.kind] || 'PARTNER';
      card.querySelector('.rv-pf-title').textContent = item.title;
      const meta = card.querySelector('.rv-pf-meta');
      const via = document.createElement('b'); via.textContent = item.source ? `via ${item.source}` : (item.company || 'Job listing');
      meta.append(via, [item.location, item.salary, ago(item.publishedAt)].filter(Boolean).map(v => ` · ${v}`).join(''));
      card.addEventListener('click', () => openItem(item));
      list.appendChild(card);
    }
  }

  async function load(key) {
    if (cache.has(key)) { render(); return; }
    cache.set(key, []);
    try {
      const response = await fetch(`/api/partner-feed?category=${encodeURIComponent(key)}`);
      if (response.ok) cache.set(key, (await response.json()).items || []);
    } catch { /* the feed works normally without partner items */ }
    render();
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    const key = button && LABELS[button.textContent.trim()];
    if (key && !button.closest('.rv-pf, [role="radiogroup"]')) { category = key; load(key); }
  }, true);
  document.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement && event.target.getAttribute('aria-label') === 'Search posts') { query = event.target.value.trim().toLowerCase(); render(); }
  });

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; render(); }, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });
  load('all');
})();
