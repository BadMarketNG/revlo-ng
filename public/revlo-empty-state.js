(() => {
  'use strict';
  // Empty category message (2026-10-03). Additive: when the chosen category / place has no posts, say so
  // and offer the next step (post the first one, or get an alert), instead of jumping to the news.
  const style = document.createElement('style');
  style.textContent = `
    .rv-empty{max-width:680px;margin:6px auto 26px;padding:22px 20px;border:1.5px dashed #c8d8c9;border-radius:16px;background:#fff;text-align:center;box-sizing:border-box}
    .rv-empty h3{margin:0 0 6px;font:900 20px/1.25 Georgia,serif;color:#1b5e20}
    .rv-empty p{margin:0 0 14px;font:14.5px/1.5 system-ui;color:#555}
    .rv-empty div{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .rv-empty button{border-radius:12px;padding:11px 16px;font:800 14.5px system-ui;cursor:pointer}
    .rv-empty .post{border:0;background:#1b5e20;color:#fff}
    .rv-empty .alert{border:1.5px solid #1b5e20;background:#fff;color:#1b5e20}
  `;
  document.head.appendChild(style);

  const lower = (t) => String(t || '').trim();
  function context() {
    const category = lower(document.querySelector('.revlo-managed-categories button.active')?.textContent);
    const place = [...document.querySelectorAll('select')].map((s) => s.selectedOptions?.[0]?.textContent || '').find((t) => /,|FCT/.test(t)) || '';
    return { category: category && category !== 'All' ? category : '', place: lower(place).replace(/^📍\s*/, '') };
  }

  function update() {
    const hasPosts = document.querySelector('article[id^="post-"], article[data-sample], .rv-job-post');
    const countLine = [...document.querySelectorAll('main *')].find((e) => e.children.length <= 3 && /^0 live posts/.test(lower(e.textContent)));
    let box = document.querySelector('.rv-empty');
    if (hasPosts || !countLine) { box?.remove(); return; }
    const { category, place } = context();
    const what = category ? category.toLowerCase() : 'posts';
    const where = place && !/all locations/i.test(place) ? ` in ${place.split(',')[0]}` : '';
    if (!box) {
      box = document.createElement('section');
      box.className = 'rv-empty';
      box.innerHTML = '<h3></h3><p>Posts on Revlo come down when their time is up, so new ones appear all the time.</p><div><button type="button" class="post">＋ Post one free</button><button type="button" class="alert">🔔 Alert me when one appears</button></div>';
      box.querySelector('.post').addEventListener('click', () => document.querySelector('button[aria-label="Create a post directly"], button[aria-label="Create post"]')?.click());
      box.querySelector('.alert').addEventListener('click', () => document.querySelector('.rv-al-chip:not([hidden])')?.click() || [...document.querySelectorAll('.rv-al-chip')].find((c) => c.offsetParent)?.click());
      const anchor = document.querySelector('.rv-st-pinned') || countLine.closest('main > *');
      anchor?.insertAdjacentElement('afterend', box);
    }
    box.querySelector('h3').textContent = `No ${what}${where} right now. Be the first!`;
    box.querySelector('p').textContent = 'Posts on Revlo come down when their time is up, so new ones appear all the time.';
    box.querySelector('.post').textContent = '＋ Post one free';
  }

  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; update(); }, 250); })
    .observe(document.documentElement, { childList: true, subtree: true, characterData: true });
})();
