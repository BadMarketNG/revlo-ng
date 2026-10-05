(() => {
  'use strict';
  // "Need it gone today?" (2026-10-02). Additive script; Codex's headline and feed are unchanged.
  // - Headline area: the eyebrow becomes "Need it gone today?" and a rotating line of urgent prompts
  //   with a "Post for 24 hours" button sits under the intro.
  // - Post form: the 24h duration is tagged "Gone today"; Jobs + 24h shows "Shows as a 24-Hour Job".
  // - Feed: 24-hour posts get a badge with the time left ("24-Hour Job" for jobs), and a
  //   "Gone in 24h" chip filters the feed to every 24-hour post (any category).
  //   (2026-10-02: widened from jobs only at the owner's request.)
  // 24-hour posts already exist (the "24h · Today" duration, stored as "now"); they count as a normal post.

  const URGENT_PROMPT = 'Need a response today?';
  const G = '#1b5e20';
  let urgent = new Map(); // uid -> { category, expiresAt }
  let dayOnly = false;

  const style = document.createElement('style');
  style.textContent = `
    .rv-ur-line{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:16px;padding:12px 14px;border-radius:14px;background:#fff7e6;border:1px solid #f3dfb0}
    .rv-ur-prompt{font:800 17px/1.2 system-ui;color:#3d2a00;min-width:12ch}
    .rv-ur-btn{border:0;border-radius:12px;background:#b45309;color:#fff;font:700 14px system-ui;padding:10px 14px;cursor:pointer}
    .rv-ur-btn:hover{background:#92400e}
    .rv-ur-badge{position:absolute;z-index:3;top:12px;right:12px;display:inline-flex;align-items:center;gap:6px;background:#b45309;color:#fff;border-radius:999px;padding:5px 10px;font:800 11.5px/1 system-ui;letter-spacing:.02em;box-shadow:0 4px 12px rgba(0,0,0,.18)}
    .rv-ur-badge small{font-weight:600;opacity:.9}
    .rv-ur-chip{border:1.5px dashed #b45309!important;color:#92400e!important;background:#fff7e6!important}
    .rv-ur-chip[aria-pressed="true"]{background:#b45309!important;color:#fff!important;border-style:solid!important}
    .rv-ur-empty{margin:18px auto;max-width:680px;padding:18px;border-radius:14px;background:#fff7e6;border:1px solid #f3dfb0;font:15px/1.5 system-ui;color:#3d2a00;text-align:center}
    .rv-ur-tag{display:block;margin-top:4px;font:800 10px/1 system-ui;letter-spacing:.05em;text-transform:uppercase;color:#b45309}
    .rv-ur-hint{margin:6px 2px 0;font:600 12.5px system-ui;color:#92400e}
  `;
  document.head.appendChild(style);

  const remaining = expiresAt => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (!(ms > 0)) return 'ending';
    const h = Math.floor(ms / 3600000);
    return h >= 1 ? `${h}h left` : `${Math.max(1, Math.round(ms / 60000))}m left`;
  };

  function postButton() {
    return document.querySelector('button[aria-label="Create post"]');
  }

  // Headline area.
  function decorateHero() {
    const h1 = [...document.querySelectorAll('h1')].find(h => /Post directly|Find work, places and things nearby/.test(h.textContent));
    if (!h1 || h1.dataset.rvUrgent) return;
    h1.dataset.rvUrgent = '1';
    const eyebrow = h1.previousElementSibling;
    if (eyebrow && eyebrow.tagName === 'P') eyebrow.textContent = 'Jobs, rentals and items for sale';
    const intro = h1.nextElementSibling;
    const line = document.createElement('div');
    line.className = 'rv-ur-line';
    line.innerHTML = '<span class="rv-ur-prompt" aria-live="polite"></span><button type="button" class="rv-ur-btn">Post a 24-hour listing</button>';
    (intro || h1).insertAdjacentElement('afterend', line);
    const prompt = line.querySelector('.rv-ur-prompt');
    prompt.textContent = URGENT_PROMPT;
    // The form opens on the 24h duration by default; this simply opens it.
    line.querySelector('button').addEventListener('click', () => postButton()?.click());
  }

  // Post form: tag the 24h option, and tell job posters how it will appear.
  function decorateForm() {
    const group = document.querySelector('[role="radiogroup"][aria-label="Duration"]');
    if (!group) return;
    // ORIGINAL (2026-10-03): const first = group.querySelector('button[role="radio"]');
    // NOTE: the first option is now "18h Hot", so the 24-hour option is found by its label.
    const first = [...group.querySelectorAll('button[role="radio"]')].find(b => /^24h/.test(b.textContent.trim()));
    if (first && !first.querySelector('.rv-ur-tag')) {
      const tag = document.createElement('span');
      tag.className = 'rv-ur-tag';
      tag.textContent = 'Gone today';
      first.appendChild(tag);
    }
    const dayChosen = first?.getAttribute('aria-checked') === 'true';
    const category = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'jobs'));
    let hint = group.parentElement?.querySelector('.rv-ur-hint');
    const show = dayChosen && category?.value === 'jobs';
    if (show && !hint) {
      hint = document.createElement('p');
      hint.className = 'rv-ur-hint';
      hint.textContent = '⚡ Shows as a 24-Hour Job, and comes down after 24 hours.';
      group.insertAdjacentElement('afterend', hint);
    } else if (!show && hint) hint.remove();
  }

  // Feed: badges and the Gone in 24h filter.
  function decorateCards() {
    document.querySelectorAll('article[id^="post-"]').forEach(article => {
      const uid = article.id.slice(5);
      const info = urgent.get(uid);
      let badge = article.querySelector('.rv-ur-badge');
      if (info) {
        if (getComputedStyle(article).position === 'static') article.style.position = 'relative';
        if (!badge) { badge = document.createElement('span'); badge.className = 'rv-ur-badge'; article.appendChild(badge); }
        badge.innerHTML = '';
        badge.append(info.category === 'jobs' ? '⚡ 24-Hour Job' : '⚡ 24 hours only');
        const time = document.createElement('small'); time.textContent = `· ${remaining(info.expiresAt)}`; badge.appendChild(time);
      } else if (badge) badge.remove();
      const keep = !dayOnly || Boolean(info);
      article.style.display = keep ? '' : 'none';
    });
    syncCountLine();
    const empty = document.querySelector('.rv-ur-empty');
    const any = urgent.size > 0;
    if (dayOnly && !any && !empty) {
      const feed = document.querySelector('article[id^="post-"]')?.parentElement || document.querySelector('main');
      const note = document.createElement('div');
      note.className = 'rv-ur-empty';
      note.innerHTML = 'Nothing ending in the next 24 hours yet. <button type="button" class="rv-ur-btn" style="margin-left:8px">Post one</button>';
      note.querySelector('button').addEventListener('click', () => postButton()?.click());
      feed?.parentElement?.insertBefore(note, feed);
    } else if ((!dayOnly || any) && empty) empty.remove();
  }

  // The feed's "N live posts · N ideas" line counts everything in the tab; while "Gone in 24h" is on it is
  // hidden and a line with the 24-hour count shows instead (the original line is left untouched for React).
  function syncCountLine() {
    const original = [...document.querySelectorAll('main *')].find(e => !e.classList.contains('rv-ur-count') && e.children.length <= 3 && /^\d+ live posts?/.test(e.textContent.trim()));
    let mine = document.querySelector('.rv-ur-count');
    if (!dayOnly || !original) {
      mine?.remove();
      document.querySelectorAll('[data-rv-ur-hidden]').forEach(e => { e.style.display = ''; e.removeAttribute('data-rv-ur-hidden'); });
      return;
    }
    const shown = [...document.querySelectorAll('article[id^="post-"]')].filter(a => a.style.display !== 'none').length;
    if (!mine) { mine = document.createElement(original.tagName); mine.className = `${original.className} rv-ur-count`; original.insertAdjacentElement('afterend', mine); }
    mine.style.cssText = original.style.cssText; mine.style.display = '';
    mine.innerHTML = `<strong>${shown}</strong> live post${shown === 1 ? '' : 's'} · gone in 24h`;
    original.style.display = 'none'; original.setAttribute('data-rv-ur-hidden', '1');
  }

  // ORIGINAL (2026-10-03): the chip copied the "All" button's classes, including its "active" (selected)
  // look, so it always looked switched on and toggled on top of the selected category.
  // NOTE: it now behaves like a category choice: unselected by default; selecting it shows every 24-hour
  // post across all categories (All is selected behind it); choosing any category or All turns it off.
  let ignoreCategoryClick = false;
  function addChip() {
    // The visible category bar only (the page also keeps hidden copies of some controls).
    const allButton = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'All' && !b.closest('[role="radiogroup"], .rv-pf') && b.offsetParent !== null);
    if (!allButton) return;
    let chip = allButton.parentElement.querySelector('.rv-ur-chip');
    if (!chip) {
      chip = allButton.cloneNode(false);
      chip.className = `${allButton.className.replace(/\bactive\b/g, '').trim()} rv-ur-chip`;
      chip.removeAttribute('aria-current');
      chip.type = 'button';
      chip.textContent = '⚡ Gone in 24h';
      chip.addEventListener('click', () => {
        dayOnly = !dayOnly;
        if (dayOnly && !allButton.classList.contains('active')) { ignoreCategoryClick = true; allButton.click(); ignoreCategoryClick = false; }
        syncChip();
        decorateCards();
      });
      allButton.insertAdjacentElement('afterend', chip);
    }
    syncChip();
  }
  function syncChip() {
    const allButton = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'All' && !b.closest('[role="radiogroup"], .rv-pf') && b.offsetParent !== null);
    const chip = allButton?.parentElement.querySelector('.rv-ur-chip');
    if (!chip) return;
    chip.className = `${allButton.className.replace(/\bactive\b/g, '').trim()} rv-ur-chip${dayOnly ? ' active' : ''}`;
    chip.setAttribute('aria-pressed', String(dayOnly));
    // While "Gone in 24h" is selected, it is the highlighted choice, not "All".
    if (dayOnly) allButton.classList.remove('active');
  }
  // Choosing a category (or All) turns "Gone in 24h" off.
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('.revlo-managed-categories button') : null;
    if (!button || button.classList.contains('rv-ur-chip') || button.classList.contains('rv-al-chip') || ignoreCategoryClick || !dayOnly) return;
    dayOnly = false; setTimeout(() => { syncChip(); decorateCards(); }, 0);
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target instanceof HTMLSelectElement && event.target.classList.contains('revlo-more-categories') && dayOnly) { dayOnly = false; setTimeout(() => { syncChip(); decorateCards(); }, 0); }
  }, true);

  async function load() {
    try {
      // Every 24-hour post is in the "Right now" list for its whole life.
      const response = await fetch('/api/posts?duration=now', { cache: 'no-store' });
      if (!response.ok) return;
      const body = await response.json();
      const posts = Array.isArray(body) ? body : (body.posts || body.data || []);
      urgent = new Map(posts.filter(p => p && p.duration === 'now' && p.uid).map(p => [p.uid, { category: p.category, expiresAt: p.expires_at }]));
      decorateCards();
    } catch { /* the feed works normally without the badges */ }
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; decorateHero(); decorateForm(); addChip(); decorateCards(); }, 60);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
  document.addEventListener('change', event => { if (event.target instanceof HTMLSelectElement) decorateForm(); });
  load();
  setInterval(load, 5 * 60_000);
  setInterval(decorateCards, 60_000); // keep "hours left" current
})();
