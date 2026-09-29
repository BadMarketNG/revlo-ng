(() => {
  'use strict';
  const KEY = 'revlo_feed_layout';
  const apply = (mode) => {
    document.body.classList.toggle('revlo-two-column', mode === 'grid');
    document.querySelectorAll('.revlo-layout-toggle button').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
    });
    try { localStorage.setItem(KEY, mode); } catch {}
  };
  function addToggle() {
    if (document.querySelector('.revlo-layout-toggle')) return true;
    const sort = [...document.querySelectorAll('select')].find((select) => [...select.options].some((option) => option.value === 'views'));
    const row = sort?.parentElement?.parentElement;
    if (!row) return false;
    const control = document.createElement('div');
    control.className = 'revlo-layout-toggle';
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', 'Feed layout');
    control.innerHTML = '<button type="button" data-mode="list" title="One post per row">List</button><button type="button" data-mode="grid" title="Two posts per row">Two-column</button>';
    control.querySelectorAll('button').forEach((button) => button.onclick = () => apply(button.dataset.mode));
    row.appendChild(control);
    let saved = 'list'; try { saved = localStorage.getItem(KEY) || 'list'; } catch {}
    apply(saved);
    return true;
  }
  const start = () => {
    if (addToggle()) return;
    const observer = new MutationObserver(() => { if (addToggle()) observer.disconnect(); });
    observer.observe(document.querySelector('#root') || document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
