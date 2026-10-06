(() => {
  'use strict';
  let settings = null;

  const replaceText = (element, text) => {
    if (!element) return;
    const node = [...element.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
    if (node) node.textContent = `${node.textContent.match(/^\s*/)?.[0] || ''}${text}`;
    else element.append(text);
  };

  function apply() {
    if (!settings) return;
    const h1 = [...document.querySelectorAll('h1')].find(node => /Post directly|Find work, places and things nearby/.test(node.textContent) || node.dataset.rvHomepageCopy);
    if (h1) {
      h1.dataset.rvHomepageCopy = '1';
      const second = h1.querySelector('span');
      if (h1.firstChild) h1.firstChild.textContent = settings.heroLine1;
      if (second) second.textContent = settings.heroLine2;
      const intro = h1.nextElementSibling;
      if (intro?.tagName === 'P') intro.textContent = settings.heroDescription;
    }
    const urgentButton = document.querySelector('.rv-ur-btn');
    if (urgentButton) urgentButton.textContent = settings.urgentButton;

    const slots = [
      ['benefitNoSignup', /No sign-up/i],
      ['benefitEnquiries', /No comments or debates|Direct enquiries/i],
      ['benefitViewings', /Request viewings online/i],
      ['benefitExpiry', /Expires in 24h/i],
    ];
    for (const pill of document.querySelectorAll('#revlo-header-details span.revlo-theme-muted-surface')) {
      let key = pill.dataset.rvCopySlot;
      if (!key) key = slots.find(([, pattern]) => pattern.test(pill.textContent))?.[0];
      if (key && settings[key]) { pill.dataset.rvCopySlot = key; replaceText(pill, settings[key]); }
    }
  }

  fetch('/api/homepage-copy', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(data => {
    if (!data) return;
    settings = data;
    window.__revloHomepageCopy = data;
    window.dispatchEvent(new CustomEvent('revlo:homepage-copy', { detail: data }));
    apply();
  }).catch(() => {});

  let queued = false;
  new MutationObserver(() => {
    if (!settings || queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; apply(); });
  }).observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
})();
