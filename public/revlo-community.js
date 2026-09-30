(() => {
  'use strict';
  // Follow reasons and poster aliases (2026-09-30).
  // 1. The "Follow this poster" window gets an optional note: why are you following?
  // 2. Notes appear under the poster's posts: the newest one, the total, and a
  //    button to reveal the rest. Follower emails are never shown.
  // 3. The "New post" form gets an alias field, pre-filled with the publisher's
  //    current alias; clearing it removes the alias.
  // 4. The alias appears before the city on each post, e.g. "📍 Billy Lagos, Nigeria".
  // 5. Uploaded images (header and gallery, and their enlarged views) carry a
  //    clear "With @Billy" watermark. It is drawn over the image rather than
  //    burned into the file, so it always matches the current alias.
  const REASON_MAX = 200;
  const ALIAS_MAX = 24;
  const aliases = new Map(); // post uid -> alias
  const imageAlias = new Map(); // image URL -> alias, for enlarged views outside the card
  const reasons = new Map(); // post uid -> { count, reasons }
  const requested = new Set();

  const style = document.createElement('style');
  style.textContent = `
    .rv-reason-field{margin:2px 0 14px;text-align:left}
    .rv-reason-field label{display:block;font:700 14px/1.3 system-ui;color:#1f3b24;margin-bottom:4px}
    .rv-reason-field .rv-hint{font:12.5px/1.45 system-ui;color:#5f6b61;margin:0 0 8px}
    .rv-reason-field textarea{width:100%;box-sizing:border-box;min-height:74px;resize:vertical;border:1.5px solid #cfd8cc;border-radius:14px;padding:12px 14px;font:15px/1.45 system-ui;background:#fff;color:#1a1a1a}
    .rv-reason-field textarea:focus{outline:none;border-color:#2e7d32;box-shadow:0 0 0 3px rgba(46,125,50,.14)}
    .rv-reason-field .rv-count{text-align:right;font:11.5px system-ui;color:#8a948b;margin-top:3px}
    .rv-why{margin:4px 0 12px;padding:12px 14px;border-radius:14px;background:#f3f8f1;border:1px solid #dde9da;font:14px/1.5 system-ui;color:#2b332c}
    .rv-why-head{display:flex;align-items:center;gap:8px;font:800 12.5px/1 system-ui;letter-spacing:.02em;color:#2e5e32;text-transform:uppercase;margin-bottom:8px}
    .rv-why-head span{background:#2e7d32;color:#fff;border-radius:999px;padding:3px 8px;font-size:11.5px;letter-spacing:0}
    .rv-why-item{margin:0;padding:7px 0 7px 12px;border-left:3px solid #9fcca1}
    .rv-why-item + .rv-why-item{margin-top:6px}
    .rv-why-item small{display:block;color:#7b867c;font-size:11.5px;margin-top:2px}
    .rv-why-more{margin-top:8px;border:0;background:none;color:#1b5e20;font:700 13px system-ui;cursor:pointer;padding:4px 0}
    .rv-alias{color:#1b5e20;font-weight:800;margin-right:5px}
    .rv-alias-field{margin:6px 0 12px}
    .rv-alias-field label{display:block;font:700 13px system-ui;color:#1f3b24;margin-bottom:5px}
    .rv-alias-field input{width:100%;max-width:320px;box-sizing:border-box;border:1.5px solid #d5dcd6;border-radius:999px;padding:9px 14px;font:14px system-ui;background:#fff}
    .rv-alias-field input:focus{outline:none;border-color:#2e7d32}
    .rv-alias-field .rv-hint{font:12px/1.45 system-ui;color:#6b756c;margin-top:5px}
    .rv-alias-field .rv-hint.rv-bad{color:#b42318}
    .rv-wm{position:absolute;right:14px;bottom:16px;z-index:3;pointer-events:none;user-select:none;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.52);color:#fff;font:800 15px/1 system-ui;letter-spacing:.01em;text-shadow:0 1px 2px rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(2px)}
    .rv-wm.rv-wm-sm{right:4px;bottom:4px;padding:3px 6px;font-size:10px}
  `;
  document.head.appendChild(style);

  const ago = (iso) => {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  };
  const publisher = () => { try { return JSON.parse(sessionStorage.getItem('revlo_publisher')) || null; } catch { return null; } };

  // Send the note with the follow request, and the alias with a new post.
  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (init.method === 'POST' && typeof init.body === 'string' && (url === '/api/follow' || url === '/api/posts')) {
      try {
        const body = JSON.parse(init.body);
        if (url === '/api/follow') {
          const note = document.querySelector('.rv-reason-field textarea');
          if (note && note.value.trim()) body.reason = note.value.trim();
        } else {
          const alias = document.querySelector('.rv-alias-field input');
          if (alias) body.poster_alias = alias.value.trim();
        }
        init = { ...init, body: JSON.stringify(body) };
      } catch {}
    }
    const response = await previousFetch(input, init);
    try {
      if ((url.startsWith('/api/posts?') || url === '/api/posts') && response.ok) {
        const data = await response.clone().json();
        for (const post of data.posts || (data.post ? [data.post] : [])) aliases.set(post.uid, post.poster_alias || '');
        if (data.post) {
          const stored = publisher();
          if (stored) sessionStorage.setItem('revlo_publisher', JSON.stringify({ ...stored, alias: data.post.poster_alias || null }));
        }
        setTimeout(scan, 0);
      }
    } catch {}
    return response;
  };

  function headingIn(text) {
    return [...document.querySelectorAll('h1,h2,h3')].find((h) => h.textContent.trim() === text);
  }

  // 1. Follow window
  function mountReasonField() {
    const heading = headingIn('Follow this poster');
    const scope = heading?.closest('[role="dialog"]') || heading?.parentElement?.parentElement;
    const email = scope?.querySelector('input[type="email"], input[placeholder="Your email address"]');
    if (!email || scope.querySelector('.rv-reason-field')) return;
    const box = document.createElement('div');
    box.className = 'rv-reason-field';
    box.innerHTML = `<label for="rv-reason">What made you follow? <span style="font-weight:500;color:#7b867c">(optional)</span></label>
      <p class="rv-hint">Share a few words about why this poster is worth following. Your note appears under their posts to help others decide. Your email is never shown.</p>
      <textarea id="rv-reason" maxlength="${REASON_MAX}" placeholder="e.g. Honest seller, quick to reply and the prices were fair."></textarea>
      <div class="rv-count">0 / ${REASON_MAX}</div>`;
    const area = box.querySelector('textarea');
    area.addEventListener('input', () => { box.querySelector('.rv-count').textContent = `${area.value.length} / ${REASON_MAX}`; });
    email.insertAdjacentElement('afterend', box);
  }

  // 2. Notes under posts
  function requestReasons(uids) {
    const wanted = uids.filter((uid) => !requested.has(uid));
    if (!wanted.length) return;
    wanted.forEach((uid) => requested.add(uid));
    for (let i = 0; i < wanted.length; i += 50) {
      previousFetch(`/api/follow-reasons?uids=${encodeURIComponent(wanted.slice(i, i + 50).join(','))}`)
        .then((r) => r.json())
        .then((data) => {
          for (const [uid, value] of Object.entries(data.reasons || {})) {
            reasons.set(uid, value);
            if (!aliases.has(uid)) aliases.set(uid, value.alias || '');
          }
          scan();
        })
        .catch(() => {});
    }
  }

  function footerOf(card) {
    return [...card.querySelectorAll('div')].reverse().find((div) =>
      [...div.children].some((child) => /Auto-deletes when time runs out|Expiring soon/.test(child.textContent || '')));
  }

  function renderReasons(card, uid) {
    const data = reasons.get(uid);
    if (!data || !data.count || card.querySelector('.rv-why')) return;
    const footer = footerOf(card);
    if (!footer) return;
    const box = document.createElement('div');
    box.className = 'rv-why';
    const head = document.createElement('div');
    head.className = 'rv-why-head';
    head.innerHTML = 'Why people follow <span></span>';
    head.querySelector('span').textContent = data.count;
    box.appendChild(head);
    const item = (reason) => {
      const p = document.createElement('p');
      p.className = 'rv-why-item';
      p.textContent = `“${reason.text}”`;
      const when = document.createElement('small');
      when.textContent = `A follower · ${ago(reason.at)}`;
      p.appendChild(when);
      return p;
    };
    box.appendChild(item(data.reasons[0]));
    const rest = data.reasons.slice(1);
    if (rest.length) {
      const more = document.createElement('div');
      more.hidden = true;
      rest.forEach((reason) => more.appendChild(item(reason)));
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rv-why-more';
      const closed = `Show ${rest.length} more ${rest.length === 1 ? 'reason' : 'reasons'} ▾`;
      button.textContent = closed;
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        more.hidden = !more.hidden;
        button.textContent = more.hidden ? closed : 'Show less ▴';
        button.setAttribute('aria-expanded', String(!more.hidden));
      });
      box.append(more, button);
    }
    footer.parentElement.insertBefore(box, footer);
  }

  // 4. Alias before the city
  function renderAlias(card, uid) {
    const alias = aliases.get(uid);
    const existing = card.querySelector('.rv-alias');
    if (existing && existing.dataset.alias === (alias || '')) return;
    existing?.remove();
    if (!alias) return;
    const pin = [...card.querySelectorAll('span')].find((span) => span.firstChild?.nodeType === 3 && span.firstChild.nodeValue.startsWith('\u{1F4CD}'));
    if (!pin) return;
    const label = document.createElement('span');
    label.className = 'rv-alias';
    label.dataset.alias = alias;
    label.textContent = alias;
    // Place it right after the pin, whether the city is a separate text piece or not.
    const pinText = pin.firstChild;
    const cut = pinText.nodeValue.indexOf(' ') + 1;
    if (cut > 0 && cut < pinText.nodeValue.length) pinText.splitText(cut);
    pin.insertBefore(label, pinText.nextSibling);
  }

  // 5. Watermarks
  function watermark(holder, alias) {
    if (!holder) return;
    let mark = [...holder.children].find((child) => child.classList?.contains('rv-wm'));
    if (!alias) { mark?.remove(); return; }
    if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
    if (!mark) {
      mark = document.createElement('div');
      mark.className = 'rv-wm';
      mark.setAttribute('aria-hidden', 'true');
      holder.appendChild(mark);
    }
    const text = `With @${alias}`;
    if (mark.textContent !== text) mark.textContent = text;
    mark.classList.toggle('rv-wm-sm', holder.getBoundingClientRect().width < 170);
  }

  function watermarkCard(card, uid) {
    const alias = aliases.get(uid) || '';
    const header = card.firstElementChild;
    watermark(header, alias);
    // Gallery photos: every other image in the card, except the small round icon.
    card.querySelectorAll('img').forEach((img) => {
      if (header && header.contains(img)) { if (img.currentSrc || img.src) imageAlias.set(img.currentSrc || img.src, alias); return; }
      if (img.getBoundingClientRect().width < 40) return;
      imageAlias.set(img.currentSrc || img.src, alias);
      watermark(img.parentElement, alias);
    });
  }

  // Enlarged photo viewers sit outside the card; match them by image address.
  function watermarkViewers() {
    document.querySelectorAll('img').forEach((img) => {
      if (img.closest('article[id^="post-"]')) return;
      const alias = imageAlias.get(img.currentSrc || img.src);
      if (alias !== undefined && img.getBoundingClientRect().width >= 120) watermark(img.parentElement, alias);
    });
  }

  // 3. Alias field in the New post form
  function mountAliasField() {
    const heading = headingIn('New post');
    const scope = heading?.closest('[role="dialog"]') || heading?.parentElement?.parentElement;
    if (!scope || scope.querySelector('.rv-alias-field')) return;
    const section = [...scope.querySelectorAll('*')].find((el) => el.children.length <= 3 && /Where\s*&\s*what/.test(el.textContent || '') && (el.textContent || '').length < 40);
    if (!section) return;
    const current = publisher()?.alias || '';
    const box = document.createElement('div');
    box.className = 'rv-alias-field';
    box.innerHTML = `<label for="rv-alias">Your alias <span style="font-weight:500;color:#7b867c">(optional)</span></label>
      <input id="rv-alias" maxlength="${ALIAS_MAX}" autocomplete="nickname" placeholder="e.g. Billy">
      <div class="rv-hint">Shown before your city, like “Billy Lagos, Nigeria”. It stays on all your posts until you change or clear it here. Each alias belongs to one publisher, and is freed for others after 6 months without a post.</div>`;
    const input = box.querySelector('input');
    const hint = box.querySelector('.rv-hint');
    const defaultHint = hint.textContent;
    input.value = current;
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const value = input.value.trim();
      if (!value || value === current) { hint.textContent = defaultHint; hint.classList.remove('rv-bad'); return; }
      timer = setTimeout(async () => {
        try {
          const email = publisher()?.email || '';
          const data = await previousFetch(`/api/alias-available?alias=${encodeURIComponent(value)}&email=${encodeURIComponent(email)}`).then((r) => r.json());
          if (input.value.trim() !== value) return;
          hint.textContent = data.available ? `“${value}” is available.` : (data.error || 'That alias is not available.');
          hint.classList.toggle('rv-bad', !data.available);
        } catch {}
      }, 400);
    });
    section.insertAdjacentElement('afterend', box);
  }

  function scan() {
    mountReasonField();
    mountAliasField();
    const cards = [...document.querySelectorAll('article[id^="post-"]')];
    const uids = cards.map((card) => card.id.slice(5));
    requestReasons(uids);
    cards.forEach((card) => { const uid = card.id.slice(5); renderAlias(card, uid); renderReasons(card, uid); watermarkCard(card, uid); });
    watermarkViewers();
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
