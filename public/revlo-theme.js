(() => {
  const storageKey = 'revlo_theme';
  const root = document.documentElement;
  const validThemes = new Set(['light', 'dark']);
  const savedTheme = localStorage.getItem(storageKey);
  let theme = validThemes.has(savedTheme) ? savedTheme : 'light';

  const style = document.createElement('style');
  style.textContent = `
    html { scrollbar-width: none; }
    html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; width: 0; height: 0; }
    html[data-revlo-theme="dark"] { color-scheme: dark; }
    html[data-revlo-theme="dark"],
    html[data-revlo-theme="dark"] body,
    html[data-revlo-theme="dark"] #root {
      background: #0b1220 !important;
      color: #f8fafc !important;
    }
    html[data-revlo-theme="dark"] .revlo-theme-surface { background: #111827 !important; }
    html[data-revlo-theme="dark"] .revlo-theme-muted-surface { background: #0f172a !important; }
    html[data-revlo-theme="dark"] .revlo-theme-primary-text { color: #f8fafc !important; }
    html[data-revlo-theme="dark"] .revlo-theme-muted-text { color: #cbd5e1 !important; }
    html[data-revlo-theme="dark"] .revlo-theme-border { border-color: #334155 !important; }
    html[data-revlo-theme="dark"] img[alt^="revlo.ng"] {
      background: transparent !important;
      filter: drop-shadow(0 3px 8px rgba(0,0,0,.32));
    }
    #revlo-theme-control {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483000;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid #d7dde5;
      border-radius: 12px;
      background: rgba(255,255,255,.96);
      color: #344054;
      box-shadow: 0 8px 24px rgba(15,23,42,.14);
      font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #revlo-theme-control select {
      min-width: 86px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #172033;
      padding: 6px 28px 6px 8px;
      font: inherit;
    }
    html[data-revlo-theme="dark"] #revlo-theme-control {
      border-color: #334155;
      background: rgba(17,24,39,.96);
      color: #e2e8f0;
    }
    html[data-revlo-theme="dark"] #revlo-theme-control select {
      border-color: #475569;
      background: #0f172a;
      color: #f8fafc;
    }
    @media (max-width: 640px) {
      #revlo-theme-control { right: 12px; bottom: 12px; }
      #revlo-theme-control label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
    }
  `;
  document.head.appendChild(style);

  const surfaceColors = new Set(['rgb(255, 255, 255)', 'rgb(250, 250, 250)']);
  const mutedSurfaceColors = new Set([
    'rgb(245, 246, 247)', 'rgb(247, 248, 247)', 'rgb(244, 244, 244)',
    'rgb(242, 242, 242)', 'rgb(238, 238, 238)', 'rgb(236, 239, 241)',
    'rgb(232, 232, 232)', 'rgb(227, 227, 227)',
  ]);
  const primaryTextColors = new Set([
    'rgb(0, 0, 0)', 'rgb(17, 17, 17)', 'rgb(26, 26, 26)', 'rgb(51, 51, 51)',
  ]);
  const mutedTextColors = new Set([
    'rgb(68, 68, 68)', 'rgb(85, 85, 85)', 'rgb(102, 102, 102)',
    'rgb(119, 119, 119)', 'rgb(136, 136, 136)', 'rgb(153, 153, 153)',
  ]);

  const normaliseColor = (value) => {
    if (!value) return '';
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.appendChild(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  };

  const markElement = (element) => {
    if (!(element instanceof HTMLElement) || element.id === 'revlo-theme-control') return;
    const background = normaliseColor(element.style.backgroundColor || element.style.background);
    const color = normaliseColor(element.style.color);
    if (surfaceColors.has(background)) element.classList.add('revlo-theme-surface');
    if (mutedSurfaceColors.has(background)) element.classList.add('revlo-theme-muted-surface');
    if (primaryTextColors.has(color)) element.classList.add('revlo-theme-primary-text');
    if (mutedTextColors.has(color)) element.classList.add('revlo-theme-muted-text');
    if (/(#ddd|#e3e3e3|#eee|#e5e5e5|#ccc|rgb\(221, 221, 221\)|rgb\(227, 227, 227\)|rgb\(238, 238, 238\)|rgb\(229, 229, 229\)|rgb\(204, 204, 204\))/i.test(element.style.border || '')) {
      element.classList.add('revlo-theme-border');
    }
  };

  const markTree = (node) => {
    if (!(node instanceof HTMLElement)) return;
    markElement(node);
    node.querySelectorAll('*').forEach(markElement);
  };

  const syncLogo = () => {
    const logo = document.querySelector('img[alt^="revlo.ng"]');
    if (!logo) return;
    if (!logo.dataset.revloLightLogo) logo.dataset.revloLightLogo = logo.src;
    if (theme === 'dark') {
      logo.dataset.revloDarkLogo = 'true';
      const darkSource = new URL('/revlo-logo-dark.png', location.href).href;
      if (logo.src !== darkSource) logo.src = darkSource;
    } else if (logo.dataset.revloDarkLogo === 'true') {
      logo.src = logo.dataset.revloLightLogo;
      delete logo.dataset.revloDarkLogo;
    }
  };

  const applyTheme = (nextTheme) => {
    theme = validThemes.has(nextTheme) ? nextTheme : 'light';
    root.dataset.revloTheme = theme;
    localStorage.setItem(storageKey, theme);
    const select = document.querySelector('#revlo-theme-select');
    if (select) select.value = theme;
    setTimeout(syncLogo, 0);
  };

  root.dataset.revloTheme = theme;
  const observer = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach(markTree));
    syncLogo();
  });

  const start = () => {
    const appRoot = document.querySelector('#root');
    if (appRoot) {
      markTree(appRoot);
      observer.observe(appRoot, { childList: true, subtree: true });
      setTimeout(syncLogo, 0);
    }

    const control = document.createElement('div');
    control.id = 'revlo-theme-control';
    control.innerHTML = '<label for="revlo-theme-select">Theme</label><select id="revlo-theme-select" aria-label="Page theme"><option value="light">Light</option><option value="dark">Dark</option></select>';
    document.body.appendChild(control);
    const select = control.querySelector('select');
    select.value = theme;
    select.addEventListener('change', () => applyTheme(select.value));
    applyTheme(theme);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
