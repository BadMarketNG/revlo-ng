(() => {
  const collapseKey = 'revlo_header_collapsed';

  const makeLogoTransparent = (image) => {
    if (!(image instanceof HTMLImageElement) || image.dataset.revloTransparent === 'true'
        || image.dataset.revloDarkLogo === 'true') return;
    const convert = () => {
      if (image.dataset.revloDarkLogo === 'true') return;
      if (!image.naturalWidth || !image.naturalHeight) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const red = pixels.data[index];
          const green = pixels.data[index + 1];
          const blue = pixels.data[index + 2];
          const lowest = Math.min(red, green, blue);
          const highest = Math.max(red, green, blue);
          if (lowest >= 246 && highest - lowest <= 10) pixels.data[index + 3] = 0;
          else if (lowest >= 226 && highest - lowest <= 14) {
            pixels.data[index + 3] = Math.round(255 * (246 - lowest) / 20);
          }
        }
        context.putImageData(pixels, 0, 0);
        image.src = canvas.toDataURL('image/png');
        image.style.background = 'transparent';
        image.dataset.revloTransparent = 'true';
      } catch {
        image.style.mixBlendMode = 'multiply';
      }
    };
    if (image.complete) convert();
    else image.addEventListener('load', convert, { once: true });
  };

  const enhanceHeader = () => {
    const header = document.querySelector('header');
    if (!header || header.dataset.revloEnhanced === 'true') return false;
    const logo = header.querySelector('img[alt*="revlo.ng"]');
    const firstRow = logo?.parentElement;
    if (!logo || !firstRow) return false;

    header.dataset.revloEnhanced = 'true';
    header.classList.add('revlo-public-header');
    makeLogoTransparent(logo);

    Array.from(header.children).forEach((child) => {
      if (child !== firstRow) child.classList.add('revlo-collapsible-detail');
    });

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'revlo-header-toggle';
    toggle.setAttribute('aria-controls', 'revlo-header-details');
    toggle.title = 'Collapse or expand page controls';
    firstRow.appendChild(toggle);

    const details = Array.from(header.children).filter((child) => child !== firstRow);
    if (details[0]) details[0].id = 'revlo-header-details';

    const setCollapsed = (collapsed) => {
      header.classList.toggle('revlo-header-collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.textContent = collapsed ? 'Show details ⌄' : 'Hide details ⌃';
      localStorage.setItem(collapseKey, collapsed ? 'true' : 'false');
    };
    toggle.addEventListener('click', () => setCollapsed(!header.classList.contains('revlo-header-collapsed')));
    setCollapsed(localStorage.getItem(collapseKey) === 'true');
    return true;
  };

  const style = document.createElement('style');
  style.textContent = `
    .revlo-public-header {
      border-bottom: 0 !important;
      box-shadow: none !important;
    }
    .revlo-public-header + div[style*="position: sticky"] {
      border-bottom: 0 !important;
      box-shadow: none !important;
    }
    .revlo-public-header > :first-child {
      position: relative;
    }
    .revlo-public-header img[alt*="revlo.ng"] {
      background: transparent !important;
    }
    .revlo-header-toggle {
      position: absolute;
      right: 82px;
      top: 8px;
      min-height: 36px;
      padding: 7px 11px;
      border: 1px solid #d0d5dd;
      border-radius: 999px;
      background: rgba(255,255,255,.94);
      color: #475467;
      cursor: pointer;
      font: 700 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .revlo-header-toggle:hover { border-color: #16803d; color: #16803d; }
    .revlo-header-collapsed .revlo-collapsible-detail { display: none !important; }
    .revlo-header-collapsed > :first-child { padding-bottom: 14px !important; }
    html[data-revlo-theme="dark"] .revlo-header-toggle {
      border-color: #475569;
      background: rgba(15,23,42,.94);
      color: #e2e8f0;
    }
    @media (max-width: 520px) {
      .revlo-header-toggle { right: 76px; padding: 7px 9px; font-size: 11px; }
    }
  `;
  document.head.appendChild(style);

  const start = () => {
    if (enhanceHeader()) return;
    const observer = new MutationObserver(() => {
      if (enhanceHeader()) observer.disconnect();
    });
    observer.observe(document.querySelector('#root') || document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
