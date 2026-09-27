(() => {
  const key = 'revlo_presence_id';
  let visitorId = localStorage.getItem(key);
  if (!visitorId) {
    visitorId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, visitorId);
  }

  const heartbeat = () => {
    if (document.visibilityState === 'hidden') return;
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, path: location.pathname }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  };

  heartbeat();
  const interval = setInterval(heartbeat, 25_000);
  document.addEventListener('visibilitychange', heartbeat);
  window.addEventListener('pagehide', () => clearInterval(interval), { once: true });
})();
