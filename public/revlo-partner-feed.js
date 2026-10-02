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
    .rv-pf-head{align-items:flex-end!important}
    /* Lockup: the rooster stands on the heading's baseline, its tail tucked in towards the R. */
    .rv-pf-head h2{margin:0;font:900 26px/1 Georgia,serif;color:#1b5e20;display:flex;align-items:flex-end;letter-spacing:-.01em}
    .rv-pf-head h2 picture{display:block;margin:0 -7px -2px -4px;position:relative;z-index:0}
    .rv-pf-rooster{display:block;height:62px;width:auto;filter:drop-shadow(0 1px 0 rgba(0,0,0,.06))}
    .rv-pf-head h2 .rv-pf-word{position:relative;z-index:1;padding-bottom:3px;white-space:nowrap}
    @media (max-width:560px){.rv-pf-head h2{font-size:21px}.rv-pf-rooster{height:50px}.rv-pf-head > span{max-width:42%}}
    .rv-pf-head > span{font:12px system-ui;color:#7b867c;text-align:right}
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
    /* News tiles (2026-10-02): square social-style tiles in a two-row carousel, wider than the feed. */
    .rv-pf.rv-pf-wide{max-width:none;width:min(1180px,calc(100vw - 32px));position:relative;left:50%;transform:translateX(-50%)}
    .rv-pf.rv-pf-wide .rv-pf-list{max-width:680px;margin:18px auto 0}
    .rv-pf-news{position:relative}
    .rv-pf-rail{display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,auto);grid-auto-columns:calc((100% - 42px)/4);gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;padding:2px}
    .rv-pf-rail::-webkit-scrollbar{display:none}
    @media (max-width:980px){.rv-pf-rail{grid-auto-columns:calc((100% - 28px)/3)}}
    @media (max-width:640px){.rv-pf-rail{grid-template-rows:auto;grid-auto-columns:82%}}
    .rv-pf-tile{position:relative;aspect-ratio:1;overflow:hidden;border:0;border-radius:6px;padding:0;cursor:pointer;scroll-snap-align:start;background:#14231a;color:#fff;text-align:left;font:inherit;box-shadow:0 10px 24px -14px rgba(0,0,0,.55)}
    .rv-pf-tile .rv-pf-bg{position:absolute;inset:0;background:#14231a}
    .rv-pf-tile .rv-pf-bg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .6s ease}
    .rv-pf-tile .rv-pf-bg>span{display:none}
    .rv-pf-tile:hover .rv-pf-bg img{transform:scale(1.04)}
    .rv-pf-tile:focus-visible{outline:3px solid #f5c518;outline-offset:2px}
    .rv-pf-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,0) 26%,rgba(0,0,0,.25) 48%,rgba(0,0,0,.88) 100%)}
    .rv-pf-top{position:absolute;top:14px;left:16px;right:14px;display:flex;justify-content:space-between;align-items:center;gap:8px}
    .rv-pf-brand{font:900 15px/1 system-ui;letter-spacing:-.01em;color:#fff}
    .rv-pf-brand i{font-style:normal;color:#f5c518}
    .rv-pf-src{background:#d32f2f;color:#fff;border-radius:999px;padding:4px 9px;font:700 10px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
    .rv-pf-dots{position:absolute;right:16px;top:28%;display:grid;grid-template-columns:repeat(2,4px);gap:6px;opacity:.85}
    .rv-pf-dots b{width:4px;height:4px;border-radius:50%;background:#fff}
    .rv-pf-copy{position:absolute;left:16px;right:16px;bottom:16px;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
    .rv-pf-label{background:#d32f2f;color:#fff;padding:5px 10px;font:900 12px/1 system-ui;letter-spacing:.04em;text-transform:uppercase}
    .rv-pf-headline{font:800 clamp(16px,1.55vw,21px)/1.18 system-ui;text-wrap:balance;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 1px 12px rgba(0,0,0,.45)}
    .rv-pf-headline mark{background:#f5c518;color:#1a1a1a;padding:0 4px;text-shadow:none;-webkit-box-decoration-break:clone;box-decoration-break:clone}
    .rv-pf-when{font:600 11px/1 system-ui;color:rgba(255,255,255,.8)}
    .rv-pf-tile.v1 .rv-pf-copy{align-items:center;text-align:center;bottom:18px}
    .rv-pf-tile.v1 .rv-pf-label{border-radius:999px;padding:7px 16px;font-size:14px}
    .rv-pf-tile.v1 .rv-pf-headline{font-weight:600}
    .rv-pf-tile.v2 .rv-pf-headline{text-transform:uppercase;font-weight:900;letter-spacing:.005em}
    .rv-pf-tile.v2 .rv-pf-label{background:transparent;color:#ff5a4f;font-style:italic;font-size:18px;padding:0}
    .rv-pf-tile.v3 .rv-pf-shade{background:linear-gradient(180deg,rgba(10,16,12,.92) 0%,rgba(10,16,12,.7) 55%,rgba(10,16,12,.35) 100%)}
    .rv-pf-tile.v3 .rv-pf-copy{top:52px;bottom:auto}
    .rv-pf-tile.v3 .rv-pf-headline{font-weight:500;font-size:clamp(17px,1.7vw,23px)}
    .rv-pf-tile.v3 .rv-pf-headline strong{font-weight:900}
    .rv-pf-arrow{position:absolute;top:50%;z-index:2;width:46px;height:46px;margin-top:-23px;border-radius:50%;border:0;background:#fff;color:#1a1a1a;font:700 22px/1 system-ui;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);display:grid;place-items:center}
    .rv-pf-arrow[hidden]{display:none}
    .rv-pf-arrow.prev{left:-12px}.rv-pf-arrow.next{right:-12px}
    @media (max-width:640px){.rv-pf-arrow{display:none}}
    @media (prefers-reduced-motion:reduce){.rv-pf-rail{scroll-behavior:auto}.rv-pf-tile .rv-pf-bg img{transition:none}}
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

  // Headline styling per tile: the part after a colon or dash, or the last two words, is highlighted
  // (yellow box on some tiles, bold on others), echoing social news tiles. Text is set safely.
  function headline(el, title, variant) {
    const split = title.match(/^(.{12,}?)([:—–-]\s+)(.+)$/) || title.match(/^(.+?)\s(\S+\s\S+)$/);
    if (!split || variant === 2) { el.textContent = title; return; }
    const lead = split[1] + (split.length === 4 ? split[2] : ' ');
    const tail = split[split.length - 1];
    el.append(lead);
    const em = document.createElement(variant === 3 ? 'strong' : 'mark');
    em.textContent = tail;
    if (variant === 1) el.textContent = title; else el.appendChild(em);
  }

  function tile(item, index) {
    const variant = index % 4;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `rv-pf-tile v${variant}`;
    el.setAttribute('aria-label', `${item.title}${item.source ? `, from ${item.source}` : ''}`);
    el.appendChild(thumb(item, 'rv-pf-bg'));
    el.insertAdjacentHTML('beforeend', '<span class="rv-pf-shade"></span><span class="rv-pf-top"><span class="rv-pf-brand">revlo<i>.ng</i></span></span><span class="rv-pf-dots" aria-hidden="true"><b></b><b></b><b></b><b></b><b></b><b></b></span><span class="rv-pf-copy"><span class="rv-pf-label"></span><span class="rv-pf-headline"></span><span class="rv-pf-when"></span></span>');
    if (item.source) {
      const src = document.createElement('span'); src.className = 'rv-pf-src'; src.textContent = `Source: ${item.source}`;
      el.querySelector('.rv-pf-top').appendChild(src);
    }
    const minutes = (Date.now() - Date.parse(item.publishedAt)) / 60000;
    // "Just in" only when it genuinely is: published within the last hour.
    el.querySelector('.rv-pf-label').textContent = variant === 2 ? (minutes < 60 ? 'Just in —' : 'Latest —') : (minutes < 60 ? 'Just in' : 'News update');
    headline(el.querySelector('.rv-pf-headline'), item.title, variant);
    el.querySelector('.rv-pf-when').textContent = ago(item.publishedAt);
    el.addEventListener('click', () => openItem(item));
    return el;
  }

  function newsRail(section, news) {
    let block = section.querySelector('.rv-pf-news');
    if (!news.length) { block?.remove(); return; }
    if (!block) {
      block = document.createElement('div');
      block.className = 'rv-pf-news';
      block.innerHTML = '<button type="button" class="rv-pf-arrow prev" aria-label="Previous news">‹</button><div class="rv-pf-rail" role="list"></div><button type="button" class="rv-pf-arrow next" aria-label="More news">›</button>';
      section.querySelector('.rv-pf-head').insertAdjacentElement('afterend', block);
      const rail = block.querySelector('.rv-pf-rail');
      const prev = block.querySelector('.prev'), next = block.querySelector('.next');
      const arrows = () => { prev.hidden = rail.scrollLeft < 8; next.hidden = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8; };
      prev.addEventListener('click', () => rail.scrollBy({ left: -rail.clientWidth, behavior: 'smooth' }));
      next.addEventListener('click', () => rail.scrollBy({ left: rail.clientWidth, behavior: 'smooth' }));
      rail.addEventListener('scroll', arrows, { passive: true });
      block.arrows = arrows;
    }
    const rail = block.querySelector('.rv-pf-rail');
    rail.textContent = '';
    news.slice(0, 24).forEach((item, i) => { const t = tile(item, i); t.setAttribute('role', 'listitem'); rail.appendChild(t); });
    rail.scrollLeft = 0;
    requestAnimationFrame(() => block.arrows());
  }

  function container() {
    const firstPost = document.querySelector('article[id^="post-"], article[data-sample]');
    const list = firstPost?.parentElement;
    if (!list || !list.parentElement) return null;
    let section = document.querySelector('.rv-pf');
    if (!section) {
      section = document.createElement('section');
      section.className = 'rv-pf';
      section.setAttribute('aria-label', 'Revolution Today');
      section.innerHTML = '<div class="rv-pf-head"><h2><picture><source srcset="/revlo-rooster.webp" type="image/webp"><img src="/revlo-rooster.png" alt="" width="42" height="62" class="rv-pf-rooster"></picture><span class="rv-pf-word">Revolution Today</span></h2><span>From partner sites · opens on the source</span></div><div class="rv-pf-list"></div>';
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
    // News shows as image tiles; jobs and listings keep the row cards.
    const news = items.filter(item => item.kind === 'news');
    section.classList.toggle('rv-pf-wide', news.length > 0);
    newsRail(section, news);
    for (const item of items.filter(item => item.kind !== 'news').slice(0, 30)) {
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
    // Real clicks only (2026-10-02): other scripts send automatic clicks to keep hidden copies of the
    // category bar in step, which used to switch this section back to "All".
    if (key && event.isTrusted && !button.closest('.rv-pf, [role="radiogroup"]')) { category = key; load(key); }
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
