(() => {
  'use strict';
  const TAB_KEY = 'revlo_tab_id';
  const EVENT_KEY = 'revlo_handoff_event';
  const CHANNEL = 'revlo-original-tab';
  let tabId = sessionStorage.getItem(TAB_KEY);
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem(TAB_KEY, tabId);
  }
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
  const pendingKey = (kind) => `revlo_handoff_pending_${kind}`;
  const freshMarker = (kind) => {
    try {
      const value = JSON.parse(localStorage.getItem(pendingKey(kind)) || 'null');
      return value && Date.now() - value.createdAt < 35 * 60 * 1000 ? value : null;
    } catch { return null; }
  };
  const mark = (kind) => {
    try { localStorage.setItem(pendingKey(kind), JSON.stringify({ owner: tabId, createdAt: Date.now() })); } catch {}
  };
  const publish = (message) => {
    try { channel?.postMessage(message); } catch {}
    try {
      localStorage.setItem(EVENT_KEY, JSON.stringify({ ...message, nonce: crypto.randomUUID() }));
      localStorage.removeItem(EVENT_KEY);
    } catch {}
  };
  const tokenUrl = (kind, token) => {
    const url = new URL('/app.html', location.origin);
    url.searchParams.set(kind === 'publish' ? 'token' : 'report_token', token);
    return url.toString();
  };
  const receive = (message) => {
    if (!message || message.type !== 'deliver' || message.target !== tabId) return;
    publish({ type: 'ack', target: message.sender, kind: message.kind });
    try { localStorage.removeItem(pendingKey(message.kind)); } catch {}
    location.assign(tokenUrl(message.kind, message.token));
  };
  channel?.addEventListener('message', (event) => receive(event.data));
  addEventListener('storage', (event) => {
    if (event.key !== EVENT_KEY || !event.newValue) return;
    try { receive(JSON.parse(event.newValue)); } catch {}
  });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const response = await originalFetch(input, init);
    const url = typeof input === 'string' ? input : input.url;
    if (response.ok && url === '/api/magic-link' && init.method === 'POST') mark('publish');
    if (response.ok && url === '/api/report' && init.method === 'POST' && String(init.headers?.['Content-Type'] || '').includes('application/json')) {
      try {
        const body = JSON.parse(init.body || '{}');
        if (body.action === 'request_verification') mark('report');
      } catch {}
    }
    return response;
  };
  window.RevloHandoff = { mark };

  const params = new URLSearchParams(location.search);
  const incoming = params.get('report_token')
    ? { kind: 'report', token: params.get('report_token'), parameter: 'report_token' }
    : params.get('token')
      ? { kind: 'publish', token: params.get('token'), parameter: 'token' }
      : null;
  if (!incoming) return;
  const marker = freshMarker(incoming.kind);
  if (!marker || marker.owner === tabId) return;

  const fallbackUrl = tokenUrl(incoming.kind, incoming.token);
  params.delete(incoming.parameter);
  history.replaceState(null, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
  let acknowledged = false;
  const acknowledge = (message) => {
    if (message?.type === 'ack' && message.target === tabId && message.kind === incoming.kind) acknowledged = true;
  };
  channel?.addEventListener('message', (event) => acknowledge(event.data));
  addEventListener('storage', (event) => {
    if (event.key !== EVENT_KEY || !event.newValue) return;
    try { acknowledge(JSON.parse(event.newValue)); } catch {}
  });
  publish({ type: 'deliver', target: marker.owner, sender: tabId, kind: incoming.kind, token: incoming.token });

  setTimeout(() => {
    if (!acknowledged) {
      location.replace(fallbackUrl);
      return;
    }
    const show = () => {
      const notice = document.createElement('div');
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'position:fixed;inset:0;z-index:30000;background:#f5f6f7;display:grid;place-items:center;padding:24px;font:16px system-ui;color:#17241b';
      notice.innerHTML = '<div style="max-width:460px;background:#fff;border:1px solid #dbe5dd;border-radius:20px;padding:34px;text-align:center;box-shadow:0 20px 60px #1232"><div style="font-size:40px">✓</div><h1 style="font-size:24px">Continue in your original Revlo tab</h1><p style="color:#66736a;line-height:1.55">Your email is verified and the original tab is ready. You may close this tab.</p><button type="button" style="border:0;border-radius:12px;background:#1B5E20;color:#fff;padding:12px 20px;font-weight:800;cursor:pointer">Close this tab</button></div>';
      notice.querySelector('button').onclick = () => window.close();
      document.body.appendChild(notice);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
    else show();
  }, 900);
})();
