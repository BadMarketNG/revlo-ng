(() => {
  'use strict';
  // "Full screen" switches the whole feed to large posts that scroll with the
  // page. Each post stretches from under the "All" category button to the right
  // edge of the green "Post directly" banner, and its header image fills most of the screen
  // below the navigation bar. Pressing the button again returns to the previous
  // layout (list or two-column). The choice is remembered on this device.
  const KEY = 'revlo_feed_fullscreen';
  const style = document.createElement('style');
  style.textContent = `
    .revlo-fs-btn{border:1px solid #cfd8d0;background:#fff;color:#1b5e20;border-radius:8px;padding:5px 10px;font:700 12.5px system-ui;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
    .revlo-fs-btn:hover{background:#f4faf4}
    body.revlo-feed-full article[id^="post-"]{width:auto!important;max-width:none!important;margin-left:calc(-1 * var(--rfs-left, 0px))!important;margin-right:calc(-1 * var(--rfs-right, 0px))!important}
    body.revlo-feed-full div:has(> article[id^="post-"]){grid-template-columns:minmax(0,1fr)!important;justify-content:stretch!important}
    body.revlo-feed-full article[id^="post-"]>div:first-child{height:var(--rfs-header, 60vh)!important;min-height:360px}
  `;
  document.head.appendChild(style);

  let restoreTwoColumn = false;
  const isOn = () => document.body.classList.contains('revlo-feed-full');

  // Measure the edges from the live page so the posts line up with the "All"
  // button and the Theme switcher at any window size.
  function measure() {
    const card = document.querySelector('article[id^="post-"]');
    const column = card?.parentElement;
    if (!column) return;
    const columnBox = column.getBoundingClientRect();
    const all = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'All' && button.offsetParent);
    // Right edge: the green "Post directly" banner that holds the + Post button.
    const postButton = [...document.querySelectorAll('button')].find((button) => /^[+＋]\s*Post$/.test(button.textContent.trim()) && button.offsetParent);
    const banner = postButton?.parentElement;
    const left = all ? Math.max(0, columnBox.left - all.getBoundingClientRect().left) : 0;
    const right = banner ? Math.max(0, banner.getBoundingClientRect().right - columnBox.right) : 0;
    const navbar = [...document.querySelectorAll('.revlo-theme-surface')].find((el) => getComputedStyle(el).position === 'sticky');
    const navHeight = navbar ? navbar.getBoundingClientRect().height : 120;
    const header = Math.max(360, Math.round(window.innerHeight - navHeight - 190));
    document.body.style.setProperty('--rfs-left', `${Math.round(left)}px`);
    document.body.style.setProperty('--rfs-right', `${Math.round(right)}px`);
    document.body.style.setProperty('--rfs-header', `${header}px`);
  }

  function labels() {
    document.querySelectorAll('.revlo-fs-btn').forEach((button) => {
      button.innerHTML = isOn() ? '✕ Exit full screen' : '⛶ Full screen';
      button.setAttribute('aria-pressed', String(isOn()));
    });
  }

  function setMode(on, anchor) {
    if (on === isOn()) return;
    if (on) {
      restoreTwoColumn = document.body.classList.contains('revlo-two-column');
      document.body.classList.remove('revlo-two-column');
      document.body.classList.add('revlo-feed-full');
      measure();
    } else {
      document.body.classList.remove('revlo-feed-full');
      if (restoreTwoColumn) document.body.classList.add('revlo-two-column');
    }
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {}
    labels();
    if (anchor) requestAnimationFrame(() => anchor.scrollIntoView({ block: 'start', behavior: 'smooth' }));
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
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setMode(!isOn(), card);
    });
    footer.insertBefore(button, footer.firstChild);
    labels();
  }

  function scan() {
    document.querySelectorAll('article[id^="post-"]').forEach(mount);
    if (isOn()) {
      // The layout toggle may re-apply two-column; full screen stays single-column.
      if (document.body.classList.contains('revlo-two-column')) { restoreTwoColumn = true; document.body.classList.remove('revlo-two-column'); }
      measure();
    }
  }

  window.addEventListener('resize', () => { if (isOn()) measure(); });
  // Choosing List or Two-column leaves full screen first.
  document.addEventListener('click', (event) => {
    if (isOn() && event.target instanceof Element && event.target.closest('.revlo-layout-toggle button')) {
      restoreTwoColumn = false;
      setMode(false);
    }
  }, true);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
  try { if (localStorage.getItem(KEY) === '1') setMode(true); } catch {}
})();
