(() => {
  'use strict';
  // The header alternates between the original Revlo logo and the rooster
  // logo, switching every 10 to 20 seconds with a short fade. Each logo has a
  // light and a dark version, chosen from the active theme.
  const LOGOS = [
    { light: '/revlo-logo-classic.png', dark: '/revlo-logo-classic-dark.png' },
    { light: '/revlo-logo.png', dark: '/revlo-logo-dark.png' },
  ];
  const MIN_MS = 10 * 1000;
  const MAX_MS = 20 * 1000;
  const FADE_MS = 400;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let current = 1;
  let timer = null;

  LOGOS.forEach((logo) => [logo.light, logo.dark].forEach((src) => { new Image().src = src; }));

  const findLogo = () => document.querySelector('img[alt^="revlo.ng"]');
  const isDark = () => document.documentElement.dataset.revloTheme === 'dark';
  const sourceFor = (index) => new URL(LOGOS[index][isDark() ? 'dark' : 'light'], location.href).href;

  function show(logo, index) {
    // revlo-theme.js leaves the logo alone while this script manages it.
    logo.dataset.revloRotating = 'true';
    const src = sourceFor(index);
    if (logo.src !== src) logo.src = src;
  }

  function nextDelay() {
    return MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS + 1));
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(swap, nextDelay());
  }

  function swap() {
    const logo = findLogo();
    if (!logo) return schedule();
    current = (current + 1) % LOGOS.length;
    if (reduceMotion) {
      show(logo, current);
      return schedule();
    }
    logo.style.transition = `opacity ${FADE_MS}ms ease`;
    logo.style.opacity = '0';
    setTimeout(() => {
      show(logo, current);
      logo.style.opacity = '1';
      schedule();
    }, FADE_MS);
  }

  function sync() {
    const logo = findLogo();
    if (logo) show(logo, current);
  }

  function start() {
    sync();
    new MutationObserver(sync).observe(document.querySelector('#root') || document.body, { childList: true, subtree: true });
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-revlo-theme'] });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
