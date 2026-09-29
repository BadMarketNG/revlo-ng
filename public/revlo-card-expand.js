(() => {
  'use strict';
  // Hover a post's header image for half a second and it expands to cover the
  // whole card, as on BadMarket. With gallery photos, dots switch between
  // images. It collapses shortly after the pointer leaves. Mouse users only.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const OPEN_DELAY = 500;
  const CLOSE_DELAY = 200;
  const galleries = new Map();
  let openTimer = null;
  let closeTimer = null;
  let active = null;

  // Keep each post's gallery so the expanded view can offer every photo.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input.url;
      if (url.startsWith('/api/posts?') && response.ok) {
        const body = await response.clone().json();
        for (const post of body.posts || []) {
          if (Array.isArray(post.gallery)) galleries.set(post.uid, post.gallery.filter((item) => typeof item === 'string'));
        }
      }
    } catch {}
    return response;
  };

  const style = document.createElement('style');
  style.textContent = `
    .revlo-card-expand{position:absolute;inset:0;z-index:40;border-radius:inherit;overflow:hidden;background:#111;opacity:0;transition:opacity .3s ease;pointer-events:none}
    .revlo-card-expand.is-open{opacity:1;pointer-events:auto}
    .revlo-card-expand img{width:100%;height:100%;object-fit:cover;display:block}
    .revlo-card-expand-dots{position:absolute;top:10px;right:10px;display:flex;gap:6px}
    .revlo-card-expand-dots button{width:8px;height:8px;border-radius:50%;padding:0;cursor:pointer;border:1px solid rgba(255,255,255,.9);background:rgba(255,255,255,.35);box-shadow:0 1px 2px rgba(0,0,0,.4)}
    .revlo-card-expand-dots button[aria-current="true"]{background:#fff}
  `;
  document.head.appendChild(style);

  function headerImageUrl(element) {
    const match = /url\("?([^")]+)"?\)/.exec(element?.style?.backgroundImage || '');
    return match ? match[1] : null;
  }

  function headerOf(target) {
    const card = target.closest?.('article[id^="post-"]');
    if (!card) return null;
    const header = [...card.querySelectorAll('div')].find((el) => headerImageUrl(el));
    return header && header.contains(target) ? { card, header } : null;
  }

  function cancelClose() { clearTimeout(closeTimer); closeTimer = null; }

  function close() {
    clearTimeout(openTimer);
    if (!active) return;
    const { overlay } = active;
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 300);
    active = null;
  }

  function scheduleClose() { cancelClose(); closeTimer = setTimeout(close, CLOSE_DELAY); }

  function open(card, header) {
    if (active?.card === card) return;
    close();
    const uid = card.id.slice(5);
    const images = [headerImageUrl(header), ...(galleries.get(uid) || [])].filter((url, index, all) => url && all.indexOf(url) === index);
    if (!images.length) return;
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.className = 'revlo-card-expand';
    const img = document.createElement('img');
    img.alt = '';
    img.src = images[0];
    overlay.appendChild(img);
    if (images.length > 1) {
      const dots = document.createElement('div');
      dots.className = 'revlo-card-expand-dots';
      images.forEach((url, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Show image ${index + 1} of ${images.length}`);
        if (index === 0) dot.setAttribute('aria-current', 'true');
        dot.addEventListener('click', (event) => {
          event.stopPropagation();
          img.src = url;
          dots.querySelectorAll('button').forEach((b) => b.removeAttribute('aria-current'));
          dot.setAttribute('aria-current', 'true');
        });
        dots.appendChild(dot);
      });
      overlay.appendChild(dots);
    }
    overlay.addEventListener('pointerenter', cancelClose);
    overlay.addEventListener('pointerleave', scheduleClose);
    card.appendChild(overlay);
    setTimeout(() => overlay.classList.add('is-open'), 16);
    active = { card, overlay };
  }

  document.addEventListener('pointerover', (event) => {
    const hit = headerOf(event.target);
    if (!hit || hit.header.contains(event.relatedTarget)) return;
    cancelClose();
    clearTimeout(openTimer);
    openTimer = setTimeout(() => open(hit.card, hit.header), OPEN_DELAY);
  });

  document.addEventListener('pointerout', (event) => {
    const hit = headerOf(event.target);
    if (!hit || hit.header.contains(event.relatedTarget)) return;
    clearTimeout(openTimer);
    if (active && !active.overlay.contains(event.relatedTarget)) scheduleClose();
  });

  // The overlay appears under a stationary pointer, so browsers may not report
  // entering or leaving it. Closing is therefore also based on the pointer
  // position: moving anywhere outside the enlarged card closes it.
  document.addEventListener('pointermove', (event) => {
    if (!active) return;
    const box = active.card.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (inside) cancelClose();
    else if (!closeTimer) scheduleClose();
  }, { passive: true });
  window.addEventListener('scroll', () => { if (active) close(); }, { passive: true });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
})();
