(() => {
  'use strict';
  // "On X right now" (2026-10-03). Additive: recent X posts for the selected category, from Revlo's
  // cached copy (visitors never trigger X calls). Shown as X requires: author name, @handle and photo,
  // time, the unedited text, and a link to the post on X.

  let category = 'all';
  const cache = new Map();
  const style = document.createElement('style');
  style.textContent = `
    .rv-x{max-width:680px;margin:26px auto 8px;box-sizing:border-box}
    .rv-x-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 2px 12px}
    .rv-x-head h2{margin:0;font:900 20px/1.1 Georgia,serif;color:#1b5e20}
    .rv-x-head span{font:12px system-ui;color:#7b867c}
    .rv-x-rail{display:grid;grid-auto-flow:column;grid-auto-columns:min(300px,82%);gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 8px;scrollbar-width:thin}
    .rv-x-card{scroll-snap-align:start;background:#fff;border:1.5px solid #e3e3e3;border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;min-height:150px}
    .rv-x-top{display:flex;align-items:center;gap:10px}
    .rv-x-top img{width:38px;height:38px;border-radius:50%;object-fit:cover;background:#eee}
    .rv-x-who{min-width:0;flex:1}
    .rv-x-who b{display:block;font:800 14px/1.2 system-ui;color:#0f1419;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rv-x-who span{font:13px system-ui;color:#536471}
    .rv-x-logo{font:900 18px/1 system-ui;color:#0f1419}
    .rv-x-text{margin:0;font:15px/1.45 system-ui;color:#0f1419;white-space:pre-wrap;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
    .rv-x-media{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:12px;background:#eee}
    .rv-x-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:center;font:13px system-ui;color:#536471}
    .rv-x-foot a{color:#1b5e20;font-weight:800;text-decoration:none}
  `;
  document.head.appendChild(style);

  const ago = iso => { const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
  const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text != null) e.textContent = text; return e; };

  function card(post) {
    const c = el('article', 'rv-x-card');
    const top = el('div', 'rv-x-top');
    const avatar = el('img'); avatar.alt = ''; avatar.loading = 'lazy'; avatar.referrerPolicy = 'no-referrer'; if (post.author_avatar) avatar.src = post.author_avatar;
    const who = el('div', 'rv-x-who'); who.append(el('b', '', post.author_name), el('span', '', `@${post.author_username} · ${ago(post.posted_at)}`));
    top.append(avatar, who, el('span', 'rv-x-logo', '𝕏'));
    c.append(top, el('p', 'rv-x-text', post.text));
    if (post.media_url) { const m = el('img', 'rv-x-media'); m.alt = ''; m.loading = 'lazy'; m.referrerPolicy = 'no-referrer'; m.src = post.media_url; c.appendChild(m); }
    const foot = el('div', 'rv-x-foot');
    const link = el('a', '', 'View on X ↗'); link.href = `https://x.com/${encodeURIComponent(post.author_username)}/status/${encodeURIComponent(post.id)}`; link.target = '_blank'; link.rel = 'noopener noreferrer';
    foot.append(el('span', '', post.city), link);
    c.appendChild(foot);
    return c;
  }

  function section() {
    let s = document.querySelector('.rv-x');
    const anchor = document.querySelector('.rv-pf') || document.querySelector('article[id^="post-"], article[data-sample]')?.parentElement;
    if (!anchor) return null;
    if (!s) {
      s = el('section', 'rv-x'); s.setAttribute('aria-label', 'On X right now');
      s.innerHTML = '<div class="rv-x-head"><h2>On X right now</h2><span>Posts from X · opens on X</span></div><div class="rv-x-rail"></div>';
    }
    if (s.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', s);
    return s;
  }

  function render() {
    const s = section();
    if (!s) return;
    const posts = cache.get(category) || [];
    s.hidden = posts.length === 0;
    const rail = s.querySelector('.rv-x-rail');
    const key = `${category}:${posts.map(p => p.id).join(',')}`;
    if (rail.dataset.key === key) return;
    rail.dataset.key = key;
    rail.replaceChildren(...posts.map(card));
  }

  async function load(key) {
    if (cache.has(key)) { render(); return; }
    cache.set(key, []);
    try { const r = await fetch(`/api/x-feed?category=${encodeURIComponent(key)}`); if (r.ok) cache.set(key, (await r.json()).posts || []); } catch { /* the page works without it */ }
    render();
  }

  // The category bar announces changes (public/revlo-categories.js).
  window.addEventListener('revlo:category-change', (event) => { category = event.detail || 'all'; load(category); });
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; render(); }, 200); }).observe(document.documentElement, { childList: true, subtree: true });
  load('all');
})();
