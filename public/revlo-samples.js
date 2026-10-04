(() => {
  'use strict';
  // A header image and an icon are required on every post. Publishers without
  // their own photos can pick a free stock photo (Unsplash License).
  // A chosen sample goes through the post form's
  // own image inputs, so it is resized and uploaded like any other photo.
  const LABELS = { jobs: 'Jobs', rentals: 'Rentals', for_sale: 'For Sale', vehicles: 'Vehicles', promotions: 'Promotions', general: 'General' };
  let manifest = null;
  let chosen = { header: null, icon: null };
  let expanded = { header: false, icon: false };

  fetch('/samples/manifest.json').then((r) => r.json()).then((data) => { manifest = data; }).catch(() => {});

  const style = document.createElement('style');
  style.textContent = `
    .revlo-samples{margin:14px 0 4px;padding:14px 16px;border:1px solid #e5e8e3;border-radius:16px;background:#fff;font:14px system-ui;color:#233128}
    .revlo-samples .rs-note{margin:0 0 10px;font-size:12.5px;color:#687068}
    .revlo-samples .rs-note strong{color:#233128}
    .revlo-samples.rs-missing{border-color:#c62828;box-shadow:0 0 0 3px rgba(198,40,40,.12)}
    .revlo-samples.rs-missing .rs-note{color:#c62828}
    .revlo-samples .rs-label{display:flex;justify-content:space-between;align-items:baseline;margin:10px 0 6px;font-weight:800;font-size:13px}
    .revlo-samples .rs-label span{font-weight:600;font-size:11px;color:#687068}
    .revlo-samples .rs-row{display:flex;flex-wrap:wrap;gap:8px;padding-bottom:4px;max-height:250px;overflow-y:auto}
    .revlo-samples [hidden]{display:none!important}
    .revlo-samples .rs-more{margin-top:6px;padding:5px 0;border:0;background:none;color:#1b5e20;text-decoration:underline;font:700 12.5px system-ui;cursor:pointer}
    .revlo-samples .rs-row button{flex:none;padding:0;border:2px solid transparent;border-radius:11px;overflow:hidden;cursor:pointer;background:#eef2ee;position:relative}
    .revlo-samples .rs-row button[aria-pressed="true"]{border-color:#1b5e20}
    .revlo-samples .rs-row button[aria-pressed="true"]::after{content:"✓";position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;background:#1b5e20;color:#fff;font:800 11px/18px system-ui;text-align:center}
    .revlo-samples .rs-headers img{width:112px;height:66px;object-fit:cover;display:block}
    .revlo-samples .rs-icons img{width:52px;height:52px;object-fit:cover;display:block}
  `;
  document.head.appendChild(style);

  function composerParts(modal) {
    const inputs = [...modal.querySelectorAll('input[type=file][accept="image/*"]:not([multiple])')];
    const category = [...modal.querySelectorAll('select')].find((select) => select.querySelector('option[value="for_sale"]'));
    return { headerInput: inputs[0], iconInput: inputs[1], category };
  }

  async function apply(input, src) {
    const blob = await (await fetch(src)).blob();
    const file = new File([blob], src.split('/').pop(), { type: blob.type || 'image/jpeg' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dataset.revloSample = 'true';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function thumbButton(item, pressed, onPick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(pressed));
    button.setAttribute('aria-label', item.label || item.alt || 'Sample image');
    button.title = item.label || item.alt || '';
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = '';
    img.loading = 'lazy';
    button.appendChild(img);
    button.addEventListener('click', onPick);
    return button;
  }

  function render(box, modal) {
    const { headerInput, iconInput, category } = composerParts(modal);
    const key = category?.value && manifest?.headers?.[category.value] ? category.value : 'general';
    box.querySelector('.rs-cat').textContent = LABELS[key] || 'General';
    box.querySelector('.rs-note').innerHTML = '<strong>A header image and an icon are required.</strong> Upload your own with the buttons above, or pick a real stock photo below.';
    const headers = box.querySelector('.rs-headers');
    headers.textContent = '';
    const headerItems = manifest.headers[key] || [];
    const sortedHeaders = [...headerItems].sort((a, b) => Number(b.src === chosen.header) - Number(a.src === chosen.header));
    for (const item of (expanded.header ? sortedHeaders : sortedHeaders.slice(0, 4))) {
      headers.appendChild(thumbButton(item, chosen.header === item.src, async () => {
        chosen.header = item.src;
        box.classList.remove('rs-missing');
        render(box, modal);
        if (headerInput) await apply(headerInput, item.src);
      }));
    }
    const moreHeaders = box.querySelector('.rs-more-headers');
    moreHeaders.hidden = headerItems.length <= 4;
    moreHeaders.textContent = expanded.header ? 'Show fewer photos' : `See ${headerItems.length - 4} more photos`;
    const icons = box.querySelector('.rs-icons');
    icons.textContent = '';
    const iconItems = manifest.icons || [];
    const sortedIcons = [...iconItems].sort((a, b) => Number(b.src === chosen.icon) - Number(a.src === chosen.icon));
    for (const item of (expanded.icon ? sortedIcons : sortedIcons.slice(0, 8))) {
      icons.appendChild(thumbButton(item, chosen.icon === item.src, async () => {
        chosen.icon = item.src;
        box.classList.remove('rs-missing');
        render(box, modal);
        if (iconInput) await apply(iconInput, item.src);
      }));
    }
    const moreIcons = box.querySelector('.rs-more-icons');
    moreIcons.hidden = iconItems.length <= 8;
    moreIcons.textContent = expanded.icon ? 'Show fewer icons' : `See ${iconItems.length - 8} more icons`;
  }

  function mount(modal) {
    if (!manifest || modal.querySelector('.revlo-samples')) return;
    const { headerInput, category } = composerParts(modal);
    if (!headerInput) return;
    headerInput.addEventListener('change', (event) => { if (event.isTrusted) { chosen.header = null; headerInput.dataset.revloSample = 'false'; } });
    const banner = headerInput.parentElement;
    const box = document.createElement('section');
    box.className = 'revlo-samples';
    box.innerHTML = '<p class="rs-note"><strong>A header image and an icon are required.</strong> Upload your own with the buttons above, or pick a real stock photo below.</p><div class="rs-label">Stock photos · <span class="rs-cat">General</span></div><div class="rs-row rs-headers"></div><button type="button" class="rs-more rs-more-headers"></button><div class="rs-label">Square icons</div><div class="rs-row rs-icons"></div><button type="button" class="rs-more rs-more-icons"></button>';
    banner.parentElement.insertBefore(box, banner.nextSibling);
    box.querySelector('.rs-more-headers').addEventListener('click', () => { expanded.header = !expanded.header; render(box, modal); });
    box.querySelector('.rs-more-icons').addEventListener('click', () => { expanded.icon = !expanded.icon; render(box, modal); });
    category?.addEventListener('change', () => { expanded.header = false; setTimeout(() => render(box, modal), 0); });
    render(box, modal);
  }

  // Both images are required. The app falls back to the header for a missing
  // icon, so an icon identical to the header upload also counts as missing.
  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === '/api/posts' && init.method === 'POST') {
      let body = null;
      try { body = JSON.parse(init.body); } catch {}
      if (body && (!body.header_url || !body.thumb_url || body.thumb_url === body.header_url)) {
        const box = document.querySelector('.revlo-samples');
        if (box) { box.classList.add('rs-missing'); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        const missing = !body.header_url ? 'a header image' : 'an icon';
        return new Response(JSON.stringify({ error: `Add ${missing} — upload your own or pick a free sample.` }), { status: 422, headers: { 'Content-Type': 'application/json' } });
      }
    }
    const response = await previousFetch(input, init);
    if (url === '/api/posts' && init.method === 'POST' && response.ok) chosen = { header: null, icon: null };
    return response;
  };

  new MutationObserver(() => {
    const heading = [...document.querySelectorAll('h1,h2,h3')].find((h) => h.textContent.trim() === 'New post');
    if (heading) mount(heading.closest('[role="dialog"]') || heading.parentElement?.parentElement || document.body);
    else chosen = { header: null, icon: null };
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
