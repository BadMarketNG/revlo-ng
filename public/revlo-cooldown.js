(() => {
  'use strict';
  const COOKIE = 'revlo_refresh_guard';

  function readBlockedUntil() {
    const value = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE}=`));
    if (!value) return 0;
    try {
      return Number(JSON.parse(decodeURIComponent(value.slice(COOKIE.length + 1))).blockedUntil) || 0;
    } catch {
      return 0;
    }
  }

  function clearState() {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  }

  function start() {
    const countdown = document.querySelector('#revlo-cooldown-countdown');
    const blockedUntil = readBlockedUntil();
    const update = () => {
      const remaining = blockedUntil - Date.now();
      if (remaining <= 0) {
        clearState();
        location.replace('/app.html');
        return;
      }
      const totalSeconds = Math.ceil(remaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      countdown.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
      countdown.setAttribute('aria-label', `${minutes} minutes and ${seconds} seconds remaining`);
    };
    if (!blockedUntil || blockedUntil <= Date.now()) {
      clearState();
      location.replace('/app.html');
      return;
    }
    update();
    setInterval(update, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
