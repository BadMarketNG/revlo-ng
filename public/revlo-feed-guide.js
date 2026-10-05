(() => {
  'use strict';
  const style = document.createElement('style');
  style.textContent = `
    .rv-feed-caption{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding-top:8px;color:#58645a;font:12px/1.35 system-ui}
    .rv-feed-caption strong{color:#204d32;font-size:12px}
    .rv-feed-caption.topic{padding-top:2px}
    .rv-post-kind-help{margin:0 0 14px;color:#58645a;font:13px/1.45 system-ui}
    .rv-post-kind-help strong{color:#204d32}
    .rv-example-help{margin:7px 0 0;color:#66736a;font:12px/1.35 system-ui}
    html[data-revlo-theme="dark"] .rv-feed-caption,html[data-revlo-theme="dark"] .rv-post-kind-help,html[data-revlo-theme="dark"] .rv-example-help{color:#c8d4c8}
    html[data-revlo-theme="dark"] .rv-feed-caption strong,html[data-revlo-theme="dark"] .rv-post-kind-help strong{color:#a9dfb0}
  `;
  document.head.append(style);

  function caption(before, className, label, description) {
    if (!before || before.previousElementSibling?.classList.contains(className)) return;
    const line = document.createElement('div');
    line.className = `rv-feed-caption ${className}`;
    const heading = document.createElement('strong'); heading.textContent = label;
    const text = document.createElement('span'); text.textContent = description;
    line.append(heading, text);
    before.insertAdjacentElement('beforebegin', line);
  }

  function updateHero() {
    const h1 = [...document.querySelectorAll('h1')].find(node => /Post directly|Find work, places and things nearby/.test(node.textContent));
    if (!h1) return;
    if (!h1.dataset.rvGuide) {
      h1.dataset.rvGuide = '1';
      const second = h1.querySelector('span');
      h1.firstChild.textContent = 'Find work, places and things nearby.';
      if (second) second.textContent = 'Post what you have or need.';
      const intro = h1.nextElementSibling;
      if (intro?.tagName === 'P') intro.textContent = 'Browse jobs, rentals and items for sale in your city. Post an offer or ask for what you need in minutes. Interested people reply through Revlo, and every post expires automatically.';
    }
    const action = [...document.querySelectorAll('button')].find(button => /Post something — it.s free|Post a listing — free/.test(button.textContent || '') && !button.closest('article'));
    if (action && action.textContent !== 'Post a listing — free') action.textContent = 'Post a listing — free';
    const helper = action?.parentElement?.querySelector('span');
    if (helper && helper.textContent !== 'Your email stays off the public post. Enquiries reach your inbox.') {
      helper.textContent = 'Your email stays off the public post. Enquiries reach your inbox.';
      helper.style.flexBasis = '100%';
    }
    for (const span of document.querySelectorAll('#revlo-header-details span.revlo-theme-muted-surface')) {
      if (!span.textContent.includes('No comments or debates')) continue;
      const label = [...span.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.includes('No comments or debates'));
      if (label) label.textContent = label.textContent.replace('No comments or debates', 'Direct enquiries');
    }
  }

  function updateFeed() {
    caption(document.querySelector('nav[aria-label="Post lifespan"]'), 'time', 'Listing time', 'New posts appear under Right now for their first 24 hours.');
    const managed = document.querySelector('.revlo-managed-categories');
    caption(managed?.previousElementSibling?.classList.contains('revlo-original-categories') ? managed.previousElementSibling : managed, 'topic', 'Browse by topic', 'Jobs, rentals and items for sale are always here.');
    const search = document.querySelector('input[aria-label="Search posts"]');
    if (search && search.placeholder !== 'Search jobs, rentals, items or places…') search.placeholder = 'Search jobs, rentals, items or places…';
    const kinds = document.querySelector('nav[aria-label="Post type"]');
    if (kinds && !kinds.nextElementSibling?.classList.contains('rv-post-kind-help')) {
      const help = document.createElement('p');
      help.className = 'rv-post-kind-help';
      help.innerHTML = '<strong>Offers</strong> are available listings. <strong>Wanted</strong> shows what people are looking for.';
      kinds.insertAdjacentElement('afterend', help);
    }
    const count = [...document.querySelectorAll('main span')].find(node => node.children.length <= 1 && /^\d+ live posts?/.test(node.textContent.trim()));
    if (count) {
      for (const node of count.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && /\d+ ideas?/.test(node.textContent)) {
          node.textContent = node.textContent.replace(/(\d+) ideas?/, (_, number) => `${number} example post${number === '1' ? '' : 's'}`);
        }
      }
      if (/example posts?/.test(count.textContent) && !count.parentElement?.nextElementSibling?.classList.contains('rv-example-help')) {
        const note = document.createElement('p');
        note.className = 'rv-example-help';
        note.textContent = 'Examples show how a post looks. They are not live listings.';
        count.parentElement?.insertAdjacentElement('afterend', note);
      }
    }
    for (const article of document.querySelectorAll('article[data-sample]')) {
      const badge = [...article.querySelectorAll('span')].find(node => node.childElementCount === 0 && node.textContent.trim() === 'Idea');
      if (badge) badge.textContent = 'Example';
    }
  }

  let queued = false;
  function mount() { updateHero(); updateFeed(); }
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; mount(); });
  }).observe(document.getElementById('root') || document.body, { childList: true, subtree: true, characterData: true });
  mount();
})();
