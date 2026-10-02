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

  const PROMPTS = ['Need staff today?', 'Room free this weekend?', 'Selling before you travel?', 'Promotion ends tonight?'];
  const G = '#1b5e20';
  let urgent = new Map(); // uid -> { category, expiresAt }
  let dayOnly = false;

  const style = document.createElement('style');
  style.textContent = `
    .rv-ur-line{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:16px;padding:12px 14px;border-radius:14px;background:#fff7e6;border:1px solid #f3dfb0}
    .rv-ur-prompt{font:800 17px/1.2 system-ui;color:#3d2a00;min-width:12ch;transition:opacity .35s}
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
    const h1 = [...document.querySelectorAll('h1')].find(h => /Post directly/.test(h.textContent));
    if (!h1 || h1.dataset.rvUrgent) return;
    h1.dataset.rvUrgent = '1';
    const eyebrow = h1.previousElementSibling;
    if (eyebrow && eyebrow.tagName === 'P') eyebrow.textContent = 'Need it gone today?';
    const intro = h1.nextElementSibling;
    const line = document.createElement('div');
    line.className = 'rv-ur-line';
    line.innerHTML = '<span class="rv-ur-prompt" aria-live="polite"></span><button type="button" class="rv-ur-btn">Post for 24 hours</button>';
    (intro || h1).insertAdjacentElement('afterend', line);
    const prompt = line.querySelector('.rv-ur-prompt');
    let i = 0;
    prompt.textContent = PROMPTS[0];
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInterval(() => {
        prompt.style.opacity = '0';
        setTimeout(() => { i = (i + 1) % PROMPTS.length; prompt.textContent = PROMPTS[i]; prompt.style.opacity = '1'; }, 350);
      }, 3200);
    }
    // The form opens on the 24h duration by default; this simply opens it.
    line.querySelector('button').addEventListener('click', () => postButton()?.click());
  }

  // Post form: tag the 24h option, and tell job posters how it will appear.
  function decorateForm() {
    const group = document.querySelector('[role="radiogroup"][aria-label="Duration"]');
    if (!group) return;
    const first = group.querySelector('button[role="radio"]');
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

  function addChip() {
    // The visible category bar only (the page also keeps hidden copies of some controls).
    // Placed after "All" now that it covers every category.
    const jobsButton = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'All' && !b.closest('[role="radiogroup"], .rv-pf') && b.offsetParent !== null);
    if (!jobsButton || jobsButton.parentElement.querySelector('.rv-ur-chip')) return;
    const chip = jobsButton.cloneNode(false);
    chip.className = `${jobsButton.className} rv-ur-chip`;
    chip.removeAttribute('aria-current');
    chip.type = 'button';
    chip.textContent = '⚡ Gone in 24h';
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      dayOnly = !dayOnly;
      chip.setAttribute('aria-pressed', String(dayOnly));
      decorateCards();
    });
    jobsButton.insertAdjacentElement('afterend', chip);
  }

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
