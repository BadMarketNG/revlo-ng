(() => {
  'use strict';
  // Alert me (2026-10-02). Additive: a "🔔 Alert me" button in the category bar opens a short form
  // (email, category, area, optional keyword). Double opt-in: the alert starts once the emailed link
  // is confirmed; then one email a day with new matching posts, unsubscribe in every email.

  const CATEGORIES = [['all', 'All posts'], ['jobs', 'Jobs'], ['rentals', 'Rentals'], ['for_sale', 'For Sale'], ['promotions', 'Promotions'], ['general', 'General']];
  const AREAS = ['all', 'Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Enugu', 'Kaduna', 'Benin City'];
  const LABELS = { All: 'all', Jobs: 'jobs', Rentals: 'rentals', 'For Sale': 'for_sale', Promotions: 'promotions', General: 'general' };
  let current = 'all';

  const style = document.createElement('style');
  style.textContent = `
    .rv-al-chip{border:1.5px solid #1b5e20!important;color:#1b5e20!important;background:#eef6ef!important}
    .rv-al-dialog{position:fixed;inset:0;z-index:2147480001;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
    @media (min-width:640px){.rv-al-dialog{align-items:center}}
    .rv-al-sheet{width:min(460px,100%);background:#fffdf7;border-radius:20px 20px 0 0;padding:22px 20px 24px;box-shadow:0 -10px 40px rgba(0,0,0,.25);box-sizing:border-box}
    @media (min-width:640px){.rv-al-sheet{border-radius:20px}}
    .rv-al-sheet h3{margin:0 0 4px;font:900 22px/1.2 Georgia,serif;color:#1b5e20}
    .rv-al-sheet p{margin:0 0 14px;font:14px/1.5 system-ui;color:#555}
    .rv-al-sheet form{display:grid;gap:10px}
    .rv-al-sheet label{display:grid;gap:4px;font:700 12.5px system-ui;color:#333}
    .rv-al-sheet input,.rv-al-sheet select{font:15px system-ui;padding:10px 11px;border:1.5px solid #d6d6d6;border-radius:10px;background:#fff;color:#1a1a1a;width:100%;box-sizing:border-box}
    .rv-al-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .rv-al-go{border:0;border-radius:12px;background:#1b5e20;color:#fff;font:800 15px system-ui;padding:12px 16px;cursor:pointer;margin-top:4px}
    .rv-al-go:disabled{opacity:.6;cursor:default}
    .rv-al-close{float:right;border:0;background:#eee;border-radius:999px;width:34px;height:34px;font-size:18px;cursor:pointer}
    .rv-al-fine{font:12px/1.45 system-ui!important;color:#888!important;margin:4px 0 0!important}
    .rv-al-msg{font:700 14px/1.4 system-ui;color:#1b5e20;margin:0}
    .rv-al-msg.err{color:#b42318}
    .rv-al-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147480002;background:#1b5e20;color:#fff;border-radius:12px;padding:12px 16px;font:700 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:calc(100vw - 32px)}
  `;
  document.head.appendChild(style);

  function open() {
    if (document.querySelector('.rv-al-dialog')) return;
    const dialog = document.createElement('div');
    dialog.className = 'rv-al-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'rv-al-title');
    dialog.innerHTML = `<div class="rv-al-sheet"><button type="button" class="rv-al-close" aria-label="Close">×</button>
      <h3 id="rv-al-title">Alert me</h3><p>Get one email a day when new posts match. Free, no account.</p>
      <form novalidate>
        <label>Notify me about<select name="post_type"><option value="offer">Offers and listings</option><option value="wanted">Wanted requests</option></select></label>
        <label>What are you looking for?<select name="category"></select></label>
        <div class="rv-al-row"><label>Area<select name="area"></select></label><label>Keyword (optional)<input name="keyword" maxlength="40" placeholder="e.g. self contained"></label></div>
        <label>Your email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
        <button type="submit" class="rv-al-go">Create alert</button>
        <p class="rv-al-msg" role="status" aria-live="polite"></p>
        <p class="rv-al-fine">We will email you to confirm first. Your email is never shown or shared, and every alert email has an unsubscribe link.</p>
      </form></div>`;
    const form = dialog.querySelector('form');
    CATEGORIES.forEach(([v, t]) => form.category.add(new Option(t, v)));
    AREAS.forEach(a => form.area.add(new Option(a === 'all' ? 'Anywhere' : a, a)));
    form.category.value = current;
    form.area.value = 'all';
    const close = () => { dialog.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
    dialog.querySelector('.rv-al-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const msg = form.querySelector('.rv-al-msg');
      const button = form.querySelector('.rv-al-go');
      msg.className = 'rv-al-msg';
      if (!form.email.value.trim() || !form.email.checkValidity()) { msg.classList.add('err'); msg.textContent = 'Enter a valid email address.'; form.email.focus(); return; }
      button.disabled = true; msg.textContent = 'Saving…';
      try {
        const response = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email.value, post_type: form.post_type.value, category: form.category.value, area: form.area.value, keyword: form.keyword.value }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
        form.querySelectorAll('label, .rv-al-go, .rv-al-fine').forEach(el => { el.hidden = true; });
        msg.textContent = `Check ${form.email.value.trim()} and tap the link to confirm your alert.`;
      } catch (error) {
        msg.classList.add('err'); msg.textContent = error.message; button.disabled = false;
      }
    });
    document.body.appendChild(dialog);
    form.category.focus();
  }

  function addChip() {
    const all = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'All' && !b.closest('[role="radiogroup"], .rv-pf, .rv-al-dialog') && b.offsetParent !== null);
    if (!all || all.parentElement.querySelector('.rv-al-chip')) return;
    const chip = all.cloneNode(false);
    // ORIGINAL (commented out 2026-10-03): chip.className = `${all.className} rv-al-chip`;
    // NOTE: drop "active" so Alert me never looks selected (it copied All's selected look).
    chip.className = `${all.className.replace(/\bactive\b/g, '').trim()} rv-al-chip`;
    chip.removeAttribute('aria-current');
    chip.removeAttribute('aria-pressed');
    chip.type = 'button';
    chip.textContent = '🔔 Alert me';
    chip.addEventListener('click', open);
    all.parentElement.appendChild(chip);
  }

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'rv-al-toast'; el.setAttribute('role', 'status'); el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }

  // Confirmation and invalid-link notices (the confirm link redirects here with ?alert=…).
  const flag = new URLSearchParams(location.search).get('alert');
  if (flag) {
    const text = { confirmed: '🔔 Your alert is on. Watch your inbox each morning.', done: 'This alert is already confirmed.', invalid: 'That alert link is not valid.' }[flag];
    if (text) setTimeout(() => toast(text), 1200);
    const url = new URL(location.href); url.searchParams.delete('alert'); history.replaceState(null, '', url);
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    const key = button && LABELS[button.textContent.trim()];
    // Real clicks only: other scripts send automatic clicks to keep hidden copies of the bar in step.
    if (key && event.isTrusted && !button.closest('.rv-pf, [role="radiogroup"], .rv-al-dialog')) current = key;
  }, true);
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; addChip(); }, 100); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
