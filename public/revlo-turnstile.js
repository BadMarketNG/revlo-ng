(() => {
  'use strict';
  // Cloudflare Turnstile (2026-09-30). Replaces the plain "I'm not a robot"
  // tick box in the Follow, Contact and Create a post windows with a real
  // Cloudflare check. Passing it once gives a 30-minute pass (a signed cookie
  // set by /api/turnstile), and the original tick box is ticked so the form
  // works as before. Does nothing until Turnstile keys are configured.
  const PASS_KEY = 'revlo_turnstile_pass_until';
  const PASS_MS = 29 * 60 * 1000;
  let siteKey = null;
  let apiReady = null;

  const style = document.createElement('style');
  style.textContent = `
    .rv-ts{margin:0 0 12px;min-height:66px}
    .rv-ts-ok{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:11px 14px;border:1.5px solid #cfe0d1;border-radius:14px;background:#f4faf4;color:#1b5e20;font:600 14px system-ui}
    .rv-ts-note{font:12px system-ui;color:#6b756c;margin:-6px 0 10px}
  `;
  document.head.appendChild(style);

  const passed = () => { try { return Number(sessionStorage.getItem(PASS_KEY) || 0) > Date.now(); } catch { return false; } };
  const setPassed = (on) => { try { on ? sessionStorage.setItem(PASS_KEY, String(Date.now() + PASS_MS)) : sessionStorage.removeItem(PASS_KEY); } catch {} };

  function loadApi() {
    if (!apiReady) {
      apiReady = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = () => resolve(window.turnstile);
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    return apiReady;
  }

  // The original tick boxes: a label holding a checkbox and the text "I'm not a robot".
  function robotBoxes() {
    return [...document.querySelectorAll('label')].filter((label) =>
      label.querySelector('input[type="checkbox"]') && /I.m not a robot/.test(label.textContent || ''));
  }

  function tick(label) {
    const box = label.querySelector('input[type="checkbox"]');
    if (box && !box.checked) box.click();
  }

  function untickAll() {
    robotBoxes().forEach((label) => {
      const box = label.querySelector('input[type="checkbox"]');
      if (box?.checked) box.click();
      label.nextElementSibling?.classList.contains('rv-ts-ok') && label.nextElementSibling.remove();
      label.dataset.rvTs = '';
    });
  }

  async function verify(token) {
    const res = await originalFetch('/api/turnstile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
    return res.ok;
  }

  function showPassed(label) {
    label.style.display = 'none';
    tick(label);
    if (!label.nextElementSibling?.classList.contains('rv-ts-ok')) {
      const ok = document.createElement('div');
      ok.className = 'rv-ts-ok';
      ok.textContent = '✓ Security check passed';
      label.insertAdjacentElement('afterend', ok);
    }
    label.parentElement?.querySelectorAll(':scope > .rv-ts').forEach((el) => el.remove());
  }

  async function mount(label) {
    if (passed()) { showPassed(label); label.dataset.rvTs = 'done'; return; }
    if (label.dataset.rvTs === 'widget') return;
    label.dataset.rvTs = 'widget';
    label.style.display = 'none';
    const holder = document.createElement('div');
    holder.className = 'rv-ts';
    label.insertAdjacentElement('afterend', holder);
    try {
      const turnstile = await loadApi();
      turnstile.render(holder, {
        sitekey: siteKey,
        theme: 'light',
        size: 'flexible',
        callback: async (token) => {
          if (await verify(token)) {
            setPassed(true);
            robotBoxes().forEach((other) => { showPassed(other); other.dataset.rvTs = 'done'; });
          } else {
            turnstile.reset(holder);
          }
        },
        'expired-callback': () => turnstile.reset(holder),
      });
    } catch {
      // If Cloudflare cannot load, show the original box; the server will still ask again.
      holder.remove();
      label.style.display = '';
    }
  }

  function scan() {
    if (!siteKey) return;
    robotBoxes().forEach((label) => {
      if (label.dataset.rvTs === 'done' && passed()) { tick(label); return; }
      mount(label);
    });
  }

  // When a pass runs out, the server answers 403 with { turnstile: true }:
  // ask for the check again.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    if (response.status === 403 && siteKey) {
      try {
        const body = await response.clone().json();
        if (body?.turnstile) { setPassed(false); untickAll(); setTimeout(scan, 0); }
      } catch {}
    }
    return response;
  };

  originalFetch('/api/turnstile', { cache: 'no-store' }).then((r) => r.json()).then((config) => {
    if (!config?.enabled || !config.siteKey) return;
    siteKey = config.siteKey;
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; scan(); });
    }).observe(document.documentElement, { childList: true, subtree: true });
    scan();
  }).catch(() => {});
})();
