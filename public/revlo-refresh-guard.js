(() => {
  'use strict';
  const COOKIE = 'revlo_refresh_guard';
  const WINDOW_MS = 60 * 1000;
  // ORIGINAL (commented out 2026-10-01): const REFRESH_LIMIT = 5;
  // NOTE: the limit is now a random number of refreshes between 8 and 17, picked
  // once per visitor and kept in the cookie until their next cooldown, so it
  // cannot be learned by trial and does not change on every reload.
  const MIN_REFRESH_LIMIT = 8;
  const MAX_REFRESH_LIMIT = 17;
  const MIN_COOLDOWN_MINUTES = 20;
  const MAX_COOLDOWN_MINUTES = 50;

  function readState() {
    const value = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE}=`));
    if (!value) return { reloads: [], blockedUntil: 0, limit: 0 };
    try {
      const parsed = JSON.parse(decodeURIComponent(value.slice(COOKIE.length + 1)));
      const limit = Number(parsed.limit);
      return {
        reloads: Array.isArray(parsed.reloads) ? parsed.reloads.filter(Number.isFinite) : [],
        blockedUntil: Number(parsed.blockedUntil) || 0,
        limit: limit >= MIN_REFRESH_LIMIT && limit <= MAX_REFRESH_LIMIT ? limit : 0,
      };
    } catch {
      return { reloads: [], blockedUntil: 0, limit: 0 };
    }
  }

  function writeState(state) {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(state))}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
  }

  function randomBetween(min, max) {
    const range = max - min + 1;
    if (crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      crypto.getRandomValues(value);
      return min + (value[0] % range);
    }
    return min + Math.floor(Math.random() * range);
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
  const limit = state.limit || randomBetween(MIN_REFRESH_LIMIT, MAX_REFRESH_LIMIT);
  const reloads = state.reloads.filter((time) => now - time < WINDOW_MS);
  reloads.push(now);
  // ORIGINAL (commented out 2026-10-01): if (reloads.length >= REFRESH_LIMIT) {
  if (reloads.length >= limit) {
    const blockedUntil = now + cooldownMinutes() * 60 * 1000;
    // A new random limit is picked after the cooldown.
    writeState({ reloads: [], blockedUntil, limit: 0 });
    location.replace('/cooldown.html');
    return;
  }
  writeState({ reloads, blockedUntil: 0, limit });
})();
