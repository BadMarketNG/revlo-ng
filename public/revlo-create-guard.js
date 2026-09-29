(() => {
  'use strict';
  const CREATE_COOKIE = 'revlo_create_clicks';
  const POST_ACTION_COOKIE = 'revlo_post_action_clicks_v2';
  const WINDOW_MS = 60 * 1000;
  const CREATE_LOCK_MS = 2 * 60 * 60 * 1000;
  const POST_ACTION_MIN_LOCK_MINUTES = 5;
  const POST_ACTION_MAX_LOCK_MINUTES = 10;
  // ORIGINAL (commented out 2026-09-29, Claude at the owner's request):
  // const CREATE_ALLOWED_CLICKS = 5;
  // NOTE: five clicks a minute locked genuine users out of posting for two hours.
  const CREATE_ALLOWED_CLICKS = 30;
  const POST_ACTION_ALLOWED_CLICKS = 20;

  function postActionLockMs() {
    const range = POST_ACTION_MAX_LOCK_MINUTES - POST_ACTION_MIN_LOCK_MINUTES + 1;
    if (crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      crypto.getRandomValues(value);
      return (POST_ACTION_MIN_LOCK_MINUTES + (value[0] % range)) * 60 * 1000;
    }
    return (POST_ACTION_MIN_LOCK_MINUTES + Math.floor(Math.random() * range)) * 60 * 1000;
  }

  function readState(cookie) {
    const value = document.cookie.split('; ').find((part) => part.startsWith(`${cookie}=`));
    if (!value) return { clicks: [], blockedUntil: 0 };
    try {
      const parsed = JSON.parse(decodeURIComponent(value.slice(cookie.length + 1)));
      return {
        clicks: Array.isArray(parsed.clicks) ? parsed.clicks.filter(Number.isFinite) : [],
        blockedUntil: Number(parsed.blockedUntil) || 0,
      };
    } catch {
      return { clicks: [], blockedUntil: 0 };
    }
  }

  function writeState(cookie, state, lifetimeMs) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${cookie}=${encodeURIComponent(JSON.stringify(state))}; Path=/; Max-Age=${Math.ceil(lifetimeMs / 1000)}; SameSite=Lax${secure}`;
  }

  function isCreateButton(element) {
    if (!element || element.closest('[role="dialog"]')) return false;
    const label = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`.trim();
    return label === '+' || label === '＋' || /post something|post the first one|create (?:a )?post/i.test(label);
  }

  function isPostAction(element) {
    return Boolean(element?.closest('article[id^="post-"]'));
  }

  function remainingText(blockedUntil) {
    const minutes = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 60000));
    return minutes >= 60 ? `${Math.ceil(minutes / 60)} hours` : `${minutes} minutes`;
  }

  function showNotice(kind, blockedUntil) {
    document.querySelector('.revlo-create-guard-notice')?.remove();
    const notice = document.createElement('div');
    notice.className = 'revlo-create-guard-notice';
    notice.setAttribute('role', 'alert');
    const title = kind === 'create' ? 'Post creation temporarily paused' : 'Post actions temporarily paused';
    notice.innerHTML = `<strong>${title}</strong><span>Too many attempts were made. Try again in about ${remainingText(blockedUntil)}.</span>`;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 6500);
  }

  function setLocked(element, locked, title) {
    element.classList.toggle('revlo-action-locked', locked);
    element.setAttribute('aria-disabled', String(locked));
    if (locked) element.title = title;
    else if (/^(Post creation|Post actions) is paused/.test(element.title)) element.removeAttribute('title');
  }

  function refreshActions() {
    const now = Date.now();
    const createState = readState(CREATE_COOKIE);
    const postState = readState(POST_ACTION_COOKIE);
    document.querySelectorAll('button, a').forEach((element) => {
      if (isCreateButton(element)) {
        const locked = createState.blockedUntil > now;
        setLocked(element, locked, `Post creation is paused for ${remainingText(createState.blockedUntil)}`);
      } else if (isPostAction(element)) {
        const locked = postState.blockedUntil > now;
        setLocked(element, locked, `Post actions are paused for ${remainingText(postState.blockedUntil)}`);
      }
    });
  }

  function handleLimit(event, kind, cookie, lockDuration, allowedClicks) {
    const now = Date.now();
    const state = readState(cookie);
    const stateLifetime = typeof lockDuration === 'function'
      ? POST_ACTION_MAX_LOCK_MINUTES * 60 * 1000
      : lockDuration;
    if (state.blockedUntil > now) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showNotice(kind, state.blockedUntil);
      return;
    }
    const recent = state.clicks.filter((time) => now - time < WINDOW_MS);
    if (recent.length >= allowedClicks) {
      const lockMs = typeof lockDuration === 'function' ? lockDuration() : lockDuration;
      const blockedUntil = now + lockMs;
      writeState(cookie, { clicks: [], blockedUntil }, lockMs);
      event.preventDefault();
      event.stopImmediatePropagation();
      refreshActions();
      showNotice(kind, blockedUntil);
      return;
    }
    recent.push(now);
    writeState(cookie, { clicks: recent, blockedUntil: 0 }, stateLifetime);
  }

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const element = target?.closest('button, a');
    if (isCreateButton(element)) {
      handleLimit(event, 'create', CREATE_COOKIE, CREATE_LOCK_MS, CREATE_ALLOWED_CLICKS);
    } else if (isPostAction(element)) {
      handleLimit(event, 'post', POST_ACTION_COOKIE, postActionLockMs, POST_ACTION_ALLOWED_CLICKS);
    }
  }, true);

  const style = document.createElement('style');
  style.textContent = `.revlo-action-locked{filter:grayscale(.65);opacity:.52!important;cursor:not-allowed!important}.revlo-create-guard-notice{position:fixed;left:50%;bottom:28px;z-index:32000;transform:translateX(-50%);display:grid;gap:4px;width:min(430px,calc(100% - 32px));box-sizing:border-box;padding:14px 17px;border:1px solid #e6c66c;border-radius:14px;background:#fff8dd;color:#3d351f;box-shadow:0 12px 36px #0003;font:14px/1.45 system-ui}.revlo-create-guard-notice strong{font-size:15px;color:#292313}@media(max-width:600px){.revlo-create-guard-notice{bottom:16px}}`;
  document.head.appendChild(style);

  const start = () => {
    refreshActions();
    new MutationObserver(refreshActions).observe(document.querySelector('#root') || document.body, { childList: true, subtree: true });
    setInterval(refreshActions, 30 * 1000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
