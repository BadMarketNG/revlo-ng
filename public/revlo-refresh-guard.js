(() => {
  'use strict';
  const COOKIE = 'revlo_refresh_guard';
  const WINDOW_MS = 60 * 1000;
  const REFRESH_LIMIT = 5;
  const MIN_COOLDOWN_MINUTES = 20;
  const MAX_COOLDOWN_MINUTES = 50;

  function readState() {
    const value = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE}=`));
    if (!value) return { reloads: [], blockedUntil: 0 };
    try {
      const parsed = JSON.parse(decodeURIComponent(value.slice(COOKIE.length + 1)));
      return {
        reloads: Array.isArray(parsed.reloads) ? parsed.reloads.filter(Number.isFinite) : [],
        blockedUntil: Number(parsed.blockedUntil) || 0,
      };
    } catch {
      return { reloads: [], blockedUntil: 0 };
    }
  }

  function writeState(state) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(state))}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
  }

  function cooldownMinutes() {
    const range = MAX_COOLDOWN_MINUTES - MIN_COOLDOWN_MINUTES + 1;
    if (crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      crypto.getRandomValues(value);
      return MIN_COOLDOWN_MINUTES + (value[0] % range);
    }
    return MIN_COOLDOWN_MINUTES + Math.floor(Math.random() * range);
  }

  const now = Date.now();
  const state = readState();
  if (state.blockedUntil > now) {
    location.replace('/cooldown.html');
    return;
  }

  const navigation = performance.getEntriesByType('navigation')[0];
  if (navigation?.type !== 'reload') return;
  const reloads = state.reloads.filter((time) => now - time < WINDOW_MS);
  reloads.push(now);
  if (reloads.length >= REFRESH_LIMIT) {
    const blockedUntil = now + cooldownMinutes() * 60 * 1000;
    writeState({ reloads: [], blockedUntil });
    location.replace('/cooldown.html');
    return;
  }
  writeState({ reloads, blockedUntil: 0 });
})();
