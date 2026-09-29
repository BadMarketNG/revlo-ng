(() => {
  'use strict';
  // "Full screen" in each post's footer enlarges that post in the middle of the
  // screen over a dimmed page. The same card element is enlarged (not copied),
  // so Contact, Follow, Read more and the gallery keep working. Esc, the button
  // or a click on the backdrop returns to the feed.
  const style = document.createElement('style');
  style.textContent = `
    .revlo-fs-btn{border:1px solid #cfd8d0;background:#fff;color:#1b5e20;border-radius:8px;padding:5px 10px;font:700 12.5px system-ui;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
    .revlo-fs-btn:hover{background:#f4faf4}
    .revlo-fs-backdrop{position:fixed;inset:0;z-index:8999;background:rgba(10,20,12,.62);backdrop-filter:blur(2px)}
    article.revlo-post-fullscreen{position:fixed!important;z-index:9000;top:50%;left:50%;transform:translate(-50%,-50%);width:min(1160px,94vw)!important;max-width:none!important;max-height:94vh;overflow:auto;margin:0!important;box-shadow:0 30px 80px rgba(0,0,0,.45)!important}
    body.revlo-fs-open{overflow:hidden}
  `;
  document.head.appendChild(style);

  let active = null;
  let backdrop = null;

  function close() {
    if (!active) return;
    active.classList.remove('revlo-post-fullscreen');
    const button = active.querySelector('.revlo-fs-btn');
    if (button) { button.innerHTML = '⛶ Full screen'; button.setAttribute('aria-pressed', 'false'); }
    backdrop?.remove();
    backdrop = null;
    document.body.classList.remove('revlo-fs-open');
    const card = active;
    active = null;
    card.scrollIntoView({ block: 'center' });
  }

  function open(card) {
    if (active) close();
    active = card;
    backdrop = document.createElement('div');
    backdrop.className = 'revlo-fs-backdrop';
    backdrop.addEventListener('click', close);
    document.body.appendChild(backdrop);
    document.body.classList.add('revlo-fs-open');
    card.classList.add('revlo-post-fullscreen');
    card.scrollTop = 0;
    const button = card.querySelector('.revlo-fs-btn');
    if (button) { button.innerHTML = '✕ Exit full screen'; button.setAttribute('aria-pressed', 'true'); button.focus(); }
  }

  function footerOf(card) {
    return [...card.querySelectorAll('div')].reverse().find((div) =>
      [...div.children].some((child) => /Auto-deletes when time runs out|Expiring soon/.test(child.textContent || '')));
  }

  function mount(card) {
    if (card.querySelector('.revlo-fs-btn')) return;
    const footer = footerOf(card);
    if (!footer) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'revlo-fs-btn';
    button.innerHTML = '⛶ Full screen';
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (active === card) close(); else open(card);
    });
    footer.insertBefore(button, footer.firstChild);
  }

  function scan() { document.querySelectorAll('article[id^="post-"]').forEach(mount); }

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  new MutationObserver(() => {
    if (active && !document.body.contains(active)) { active = null; backdrop?.remove(); backdrop = null; document.body.classList.remove('revlo-fs-open'); }
    scan();
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
