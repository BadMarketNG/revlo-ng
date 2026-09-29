(() => {
  'use strict';
  const COOKIE = 'revlo_create_clicks';
  const WINDOW_MS = 60 * 1000;
  const LOCK_MS = 2 * 60 * 60 * 1000;
  const ALLOWED_CLICKS = 5;

  function readState() {
    const value = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE}=`));
    if (!value) return { clicks: [], blockedUntil: 0 };
    try {
      const parsed = JSON.parse(decodeURIComponent(value.slice(COOKIE.length + 1)));
      return {
        clicks: Array.isArray(parsed.clicks) ? parsed.clicks.filter(Number.isFinite) : [],
        blockedUntil: Number(parsed.blockedUntil) || 0,
      };
    } catch {
      return { clicks: [], blockedUntil: 0 };
    }
  }

  function writeState(state) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(state))}; Path=/; Max-Age=7200; SameSite=Lax${secure}`;
  }

  function isCreateButton(button) {
    if (!button || button.closest('[role="dialog"]')) return false;
    const label = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`.trim();
    return label === '+' || label === '＋' || /post something|post the first one|create (?:a )?post/i.test(label);
  }

  function remainingText(blockedUntil) {
    const minutes = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 60000));
    return minutes >= 60 ? `${Math.ceil(minutes / 60)} hours` : `${minutes} minutes`;
  }

  function showNotice(blockedUntil) {
    document.querySelector('.revlo-create-guard-notice')?.remove();
    const notice = document.createElement('div');
    notice.className = 'revlo-create-guard-notice';
    notice.setAttribute('role', 'alert');
    notice.innerHTML = `<strong>Post creation temporarily paused</strong><span>Too many creation windows were opened. Try again in about ${remainingText(blockedUntil)}.</span>`;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 6500);
  }

  function refreshButtons() {
    const state = readState();
    const locked = state.blockedUntil > Date.now();
    document.querySelectorAll('button').forEach((button) => {
      if (!isCreateButton(button)) return;
      button.classList.toggle('revlo-create-locked', locked);
      button.setAttribute('aria-disabled', String(locked));
      if (locked) button.title = `Post creation is paused for ${remainingText(state.blockedUntil)}`;
      else if (button.title.startsWith('Post creation is paused')) button.removeAttribute('title');
    });
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const button = target?.closest('button');
    if (!isCreateButton(button)) return;
    const now = Date.now();
    const state = readState();
    if (state.blockedUntil > now) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showNotice(state.blockedUntil);
      return;
    }
    const recent = state.clicks.filter((time) => now - time < WINDOW_MS);
    if (recent.length >= ALLOWED_CLICKS) {
      const blockedUntil = now + LOCK_MS;
      writeState({ clicks: [], blockedUntil });
      event.preventDefault();
      event.stopImmediatePropagation();
      refreshButtons();
      showNotice(blockedUntil);
      return;
    }
    recent.push(now);
    writeState({ clicks: recent, blockedUntil: 0 });
  }, true);

  const style = document.createElement('style');
  style.textContent = `.revlo-create-locked{filter:grayscale(.65);opacity:.52!important;cursor:not-allowed!important}.revlo-create-guard-notice{position:fixed;left:50%;bottom:28px;z-index:32000;transform:translateX(-50%);display:grid;gap:4px;width:min(430px,calc(100% - 32px));box-sizing:border-box;padding:14px 17px;border:1px solid #e6c66c;border-radius:14px;background:#fff8dd;color:#3d351f;box-shadow:0 12px 36px #0003;font:14px/1.45 system-ui}.revlo-create-guard-notice strong{font-size:15px;color:#292313}@media(max-width:600px){.revlo-create-guard-notice{bottom:16px}}`;
  document.head.appendChild(style);

  const start = () => {
    refreshButtons();
    new MutationObserver(refreshButtons).observe(document.querySelector('#root') || document.body, { childList: true, subtree: true });
    setInterval(refreshButtons, 30 * 1000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
