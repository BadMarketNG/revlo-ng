(() => {
  'use strict';
  // Longer posts are earned: 1 week needs Silver (or higher), 2½ weeks needs
  // Gold. (2026-10-03: was 2 months / 3 months; the form labels are now 7d / 17½d.) The server enforces this in /api/posts; here the choices are shown
  // as locked in the form.
  const RULES = [
    // ORIGINAL (2026-10-03): match: /^60d/ and /^90d/
    { match: /^7d/, badge: 'Silver', ok: (b) => Boolean(b), posts: (s) => s?.silver_posts || 100 },
    { match: /^17½d/, badge: 'Gold', ok: (b) => b === 'gold', posts: (s) => s?.gold_posts || 1500 },
  ];

  const style = document.createElement('style');
  style.textContent = `
    [data-revlo-locked]{opacity:.45!important;cursor:not-allowed!important}
    [data-revlo-locked]::after{content:"🔒 " attr(data-revlo-locked);display:block;margin-top:3px;font-size:10px;font-weight:800;letter-spacing:.04em;color:#6b6b6b}
  `;
  document.head.appendChild(style);

  function publisher() {
    try { return JSON.parse(sessionStorage.getItem('revlo_publisher')); } catch { return null; }
  }

  function apply() {
    const group = document.querySelector('[role="radiogroup"][aria-label="Duration"]');
    if (!group) return;
    const status = publisher();
    const buttons = [...group.querySelectorAll('button[role="radio"]')];
    for (const button of buttons) {
      const rule = RULES.find((r) => r.match.test(button.textContent.trim()));
      const locked = Boolean(rule && !rule.ok(status?.trustBadge));
      if (locked && button.getAttribute('data-revlo-locked') !== rule.badge) {
        button.setAttribute('data-revlo-locked', rule.badge);
        button.setAttribute('aria-disabled', 'true');
        button.disabled = true;
        button.title = `Unlocks with the ${rule.badge} badge at ${rule.posts(status?.settings)} verified posts.`;
      } else if (!locked && button.hasAttribute('data-revlo-locked')) {
        button.removeAttribute('data-revlo-locked');
        button.removeAttribute('aria-disabled');
        button.disabled = false;
        button.removeAttribute('title');
      }
      // Never leave a locked duration selected.
      if (locked && button.getAttribute('aria-checked') === 'true') buttons[0]?.click();
    }
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; apply(); }, 30);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
  apply();
})();
