(() => {
  'use strict';
  let categories = [];
  let selectedCategory = null;
  let selectionGeneration = 0;
  const originalFetch = window.fetch.bind(window);

  const isPostsRequest = (input, init) => {
    const method = String(init?.method || (typeof input !== 'string' ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') return false;
    const raw = typeof input === 'string' ? input : input.url;
    return new URL(raw, location.origin).pathname === '/api/posts';
  };

  const categoryRequest = (input) => {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, location.origin);
    if (selectedCategory) url.searchParams.set('category', selectedCategory);
    else url.searchParams.delete('category');
    if (typeof input === 'string') return `${url.pathname}${url.search}`;
    return new Request(url.toString(), input);
  };

  window.fetch = async (input, init) => {
    if (!isPostsRequest(input, init)) return originalFetch(input, init);
    const generation = selectionGeneration;
    const response = await originalFetch(categoryRequest(input), init);
    if (generation === selectionGeneration) return response;
    return originalFetch(categoryRequest(input), init);
  };

  function originalCategoryRow() {
    return [...document.querySelectorAll('div')].find((element) => {
      if (element.classList.contains('revlo-managed-categories')) return false;
      const labels = [...element.children]
        .filter((child) => child instanceof HTMLButtonElement)
        .map((button) => button.textContent.trim());
      return ['All', 'Jobs', 'Rentals', 'For Sale', 'Promotions', 'General', 'Rules']
        .filter((label) => labels.includes(label)).length >= 6;
    });
  }

  function clickOriginal(label) {
    const row = originalCategoryRow();
    const button = [...(row?.querySelectorAll(':scope > button') || [])]
      .find((candidate) => candidate.textContent.trim() === label);
    button?.click();
  }

  function refreshFeed() {
    const row = originalCategoryRow();
    if (!row) return;
    const buttons = [...row.querySelectorAll(':scope > button')];
    const first = buttons.find((button) => button.textContent.trim() === 'Jobs') || buttons[0];
    const all = buttons.find((button) => button.textContent.trim() === 'All');
    first?.click();
    requestAnimationFrame(() => all?.click());
  }

  function selectCategory(slug) {
    selectedCategory = slug || null;
    selectionGeneration += 1;
    renderToolbar();
    refreshFeed();
  }

  function renderToolbar() {
    const original = originalCategoryRow();
    if (!original || !categories.length) return;
    // The original row has an inline display:flex, which overrides the
    // hidden attribute, so hide it with an important rule instead.
    original.hidden = true;
    original.classList.add('revlo-original-categories');
    let managed = original.nextElementSibling;
    if (!managed?.classList.contains('revlo-managed-categories')) {
      managed = document.createElement('nav');
      managed.className = 'revlo-managed-categories';
      managed.setAttribute('aria-label', 'Post categories');
      original.insertAdjacentElement('afterend', managed);
    }
    const signature = `${selectedCategory || 'all'}:${categories.map((category) => `${category.slug}:${category.label}`).join('|')}`;
    if (managed.dataset.signature === signature) return;
    managed.dataset.signature = signature;
    managed.replaceChildren();
    const all = document.createElement('button');
    all.type = 'button';
    all.textContent = 'All';
    all.className = selectedCategory === null ? 'active' : '';
    all.addEventListener('click', () => selectCategory(null));
    managed.append(all);
    categories.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = category.label;
      button.dataset.category = category.slug;
      button.className = selectedCategory === category.slug ? 'active' : '';
      button.addEventListener('click', () => selectCategory(category.slug));
      managed.append(button);
    });
    const rules = document.createElement('a');
    rules.href = '/rules';
    rules.textContent = 'Rules';
    rules.className = 'rules';
    managed.append(rules);
  }

  function updateComposer() {
    if (!categories.length) return;
    document.querySelectorAll('select').forEach((select) => {
      const values = [...select.options].map((option) => option.value);
      if (!values.includes('for_sale') && select.dataset.revloCategorySelect !== 'true') return;
      const signature = categories.map((category) => `${category.slug}:${category.label}`).join('|');
      if (select.dataset.revloCategorySignature === signature) return;
      const current = categories.some((category) => category.slug === select.value) ? select.value : 'general';
      select.replaceChildren(...categories.map((category) => new Option(category.label, category.slug)));
      select.value = current;
      select.dataset.revloCategorySelect = 'true';
      select.dataset.revloCategorySignature = signature;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .revlo-original-categories{display:none!important}
    .revlo-managed-categories{display:flex;gap:8px;align-items:center;overflow-x:auto;padding:10px 0 12px;scrollbar-width:none}
    .revlo-managed-categories::-webkit-scrollbar{display:none}
    .revlo-managed-categories button,.revlo-managed-categories a{flex:0 0 auto;border:1.5px solid #e3e3e3;border-radius:99px;background:#fff;color:#555;padding:7px 14px;font-size:13px;font-weight:700;line-height:1.2;font-family:inherit;white-space:nowrap;text-decoration:none;cursor:pointer}
    .revlo-managed-categories button.active{border-color:#1b5e20;background:#1b5e20;color:#fff}
    .revlo-managed-categories .rules{border-style:dashed;border-color:#1b5e20;color:#1b5e20}
    html[data-revlo-theme="dark"] .revlo-managed-categories button,html[data-revlo-theme="dark"] .revlo-managed-categories a{border-color:#40506a;background:#0f192b;color:#dce5f3}
    html[data-revlo-theme="dark"] .revlo-managed-categories button.active{border-color:#247a31;background:#1b6b2a;color:#fff}
  `;
  document.head.appendChild(style);

  async function start() {
    try {
      const response = await originalFetch('/api/categories', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.categories) || !body.categories.length) return;
      categories = body.categories;
      renderToolbar();
      updateComposer();
      new MutationObserver(() => {
        renderToolbar();
        updateComposer();
      }).observe(document.querySelector('#root') || document.body, { childList: true, subtree: true });
    } catch {
      // The built-in categories remain usable if the catalogue cannot load.
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
