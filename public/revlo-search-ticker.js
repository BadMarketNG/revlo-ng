(() => {
  'use strict';
  // Search ticker (2026-10-02). Additive: attaches to the feed's existing search box.
  // - The right half of the box shows a slow, clickable ticker of searches: a mix of the most
  //   searched, the newest and everything in between (see src/lib/searchTicker.mjs).
  // - Typing shows autocomplete suggestions; searches are counted (once per term per visit).
  // A clicked term fills the box exactly as if typed, so the feed's own search does the filtering.

  const SELECTOR = 'input[aria-label="Search posts"]';
  const counted = new Set();
  let pool = [];
  let state = { items: [], label: 'Try' };

  const css = `
    .rv-st-wrap{position:absolute;top:6px;bottom:6px;right:44px;width:calc(50% - 52px);display:flex;align-items:center;gap:10px;pointer-events:auto;transition:opacity .25s}
    .rv-st-wrap.rv-st-off{opacity:0;pointer-events:none}
    .rv-st-label{flex:none;font:700 11px/1 system-ui;letter-spacing:.06em;text-transform:uppercase;color:#7b867c;padding-left:12px;border-left:1px solid #e3e3e3;height:60%;display:flex;align-items:center}
    .rv-st-viewport{position:relative;flex:1;overflow:hidden;height:100%;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 88%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 88%,transparent)}
    .rv-st-track{position:absolute;top:0;bottom:0;left:0;display:flex;align-items:center;gap:8px;width:max-content;animation:rv-st-scroll var(--rv-st-dur,90s) linear infinite}
    .rv-st-viewport:hover .rv-st-track,.rv-st-viewport:focus-within .rv-st-track{animation-play-state:paused}
    .rv-st-item{flex:none;border:0;background:#eef6ef;color:#1b5e20;border-radius:999px;padding:6px 11px;font:600 13px/1 system-ui;cursor:pointer;white-space:nowrap}
    .rv-st-item:hover,.rv-st-item:focus-visible{background:#1b5e20;color:#fff;outline:none}
    @keyframes rv-st-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    @media (prefers-reduced-motion:reduce){.rv-st-track{animation:none;position:static}.rv-st-viewport{overflow-x:auto}}
    input.rv-st-room{padding-right:calc(50% + 14px)!important}
    .rv-st-list{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:40;background:#fffdf7;border:1.5px solid #e3e3e3;border-radius:14px;box-shadow:0 12px 30px -16px rgba(0,0,0,.35);padding:6px;margin:0;list-style:none}
    .rv-st-list li{display:flex;justify-content:space-between;gap:12px;padding:9px 12px;border-radius:10px;font:15px system-ui;color:#1a1a1a;cursor:pointer}
    .rv-st-list li[aria-selected="true"],.rv-st-list li:hover{background:#eef6ef}
    .rv-st-list small{color:#7b867c;font-size:12px;white-space:nowrap}
    @media (max-width:560px){.rv-st-wrap{width:calc(50% - 40px);right:36px}.rv-st-label{display:none}.rv-st-item{font-size:12px;padding:5px 9px}}
  `;

  function addStyle() {
    if (document.getElementById('rv-st-style')) return;
    const style = document.createElement('style');
    style.id = 'rv-st-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function normalise(value) {
    const term = String(value || '').toLowerCase().replace(/^#+/, '').replace(/[^\p{L}\p{N}&' -]+/gu, ' ').replace(/\s+/g, ' ').trim();
    return term.length >= 2 && term.length <= 32 ? term : null;
  }

  function count(value) {
    const term = normalise(value);
    if (!term || counted.has(term)) return;
    counted.add(term);
    fetch('/api/search-terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ term }), keepalive: true }).catch(() => {});
  }

  // Fill the box the way typing does, so the feed's own (React) search reacts.
  function fill(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function suggest(query) {
    const q = normalise(query);
    if (!q) return [];
    const starts = [], contains = [];
    for (const p of pool) {
      if (p.term === q) continue;
      if (p.term.startsWith(q)) starts.push(p); else if (p.term.includes(q)) contains.push(p);
    }
    const byScore = (a, b) => b.score - a.score || a.term.localeCompare(b.term);
    return [...starts.sort(byScore), ...contains.sort(byScore)].slice(0, 6);
  }

  function attach(input) {
    if (input.dataset.rvSt) return;
    input.dataset.rvSt = '1';
    const host = input.parentElement;
    if (!host) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const wrap = document.createElement('div');
    wrap.className = 'rv-st-wrap';
    wrap.innerHTML = '<span class="rv-st-label"></span><div class="rv-st-viewport" role="region" aria-label="Popular searches"><div class="rv-st-track"></div></div>';
    host.appendChild(wrap);
    const label = wrap.querySelector('.rv-st-label');
    const track = wrap.querySelector('.rv-st-track');

    const list = document.createElement('ul');
    list.className = 'rv-st-list';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    host.appendChild(list);
    input.setAttribute('aria-autocomplete', 'list');

    let active = -1;
    let options = [];
    let pauseTimer = 0;

    function renderTicker() {
      label.textContent = state.label;
      const items = state.items;
      track.textContent = '';
      if (!items.length) { wrap.classList.add('rv-st-off'); input.classList.remove('rv-st-room'); return; }
      // Two copies so the loop is seamless; the copy is hidden from screen readers.
      [false, true].forEach(copy => items.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rv-st-item';
        button.textContent = item.term;
        if (copy) { button.setAttribute('aria-hidden', 'true'); button.tabIndex = -1; }
        button.addEventListener('click', () => { fill(input, item.term); count(item.term); input.focus(); sync(); });
        track.appendChild(button);
      }));
      // Slow: about seven seconds per term on screen.
      track.style.setProperty('--rv-st-dur', `${Math.max(40, items.length * 7)}s`);
      sync();
    }

    function sync() {
      const typing = input.value.trim().length > 0;
      const empty = !state.items.length;
      wrap.classList.toggle('rv-st-off', typing || empty);
      input.classList.toggle('rv-st-room', !typing && !empty);
    }

    function closeList() { list.hidden = true; active = -1; input.removeAttribute('aria-activedescendant'); }
    function renderList() {
      options = suggest(input.value);
      list.textContent = '';
      if (!options.length || document.activeElement !== input) { closeList(); return; }
      options.forEach((option, index) => {
        const li = document.createElement('li');
        li.id = `rv-st-opt-${index}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', String(index === active));
        li.innerHTML = '<span></span><small></small>';
        li.firstChild.textContent = option.term;
        li.lastChild.textContent = option.count >= 5 ? `${option.count} searches` : '';
        li.addEventListener('mousedown', event => { event.preventDefault(); choose(index); });
        list.appendChild(li);
      });
      list.hidden = false;
    }
    function choose(index) {
      const option = options[index];
      if (!option) return;
      fill(input, option.term);
      count(option.term);
      closeList();
      sync();
    }

    input.addEventListener('input', () => {
      sync();
      active = -1;
      renderList();
      window.clearTimeout(pauseTimer);
      // A search is counted when the person pauses typing, presses Enter or picks a suggestion.
      pauseTimer = window.setTimeout(() => count(input.value), 1500);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        if (!list.hidden && active >= 0) { event.preventDefault(); choose(active); return; }
        count(input.value);
        closeList();
      } else if (event.key === 'ArrowDown' && !list.hidden) {
        event.preventDefault(); active = Math.min(options.length - 1, active + 1); renderList();
        input.setAttribute('aria-activedescendant', `rv-st-opt-${active}`);
      } else if (event.key === 'ArrowUp' && !list.hidden) {
        event.preventDefault(); active = Math.max(-1, active - 1); renderList();
      } else if (event.key === 'Escape') closeList();
    });
    input.addEventListener('focus', renderList);
    input.addEventListener('blur', () => window.setTimeout(closeList, 120));

    attach.render = renderTicker;
    renderTicker();
  }

  async function load() {
    try {
      const response = await fetch('/api/search-terms', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      pool = Array.isArray(data.pool) ? data.pool : [];
      state = { items: Array.isArray(data.ticker) ? data.ticker : [], label: data.label === 'Popular' ? 'Popular' : 'Try' };
      if (attach.render) attach.render();
    } catch { /* the search box works normally without the ticker */ }
  }

  function scan() {
    const input = document.querySelector(SELECTOR);
    if (input) attach(input);
  }

  addStyle();
  // The feed renders the search box itself (and can re-render it), so keep watching for it.
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
  load();
  window.setInterval(load, 10 * 60_000);
})();
