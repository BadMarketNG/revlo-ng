(() => {
  'use strict';
  // "Check posts available" in the Create a post window: shows how many posts
  // one emailed publish link allows for the typed email. Without a badge that is
  // 5 posts (administrator-set) within 30 minutes; Silver, Bronze and Gold links allow 50, 100 and
  // 200 posts with no time limit (see /api/publish-allowance).
  const BADGE_NAMES = { silver: 'Silver', bronze: 'Bronze', gold: 'Gold' };

  const style = document.createElement('style');
  style.textContent = `
    .revlo-allowance{margin:-4px 0 12px;font:13px/1.45 system-ui;color:#4b5a50}
    .revlo-allowance button{border:1px solid #cfe0d1;background:#f4faf4;color:#1b5e20;font-weight:700;border-radius:999px;padding:6px 12px;cursor:pointer;font-size:12.5px}
    .revlo-allowance button:disabled{opacity:.5;cursor:default}
    .revlo-allowance .ra-result{margin-top:8px;padding:9px 11px;border-radius:10px;background:#f4faf4;border:1px solid #dcebdd}
    .revlo-allowance .ra-result.ra-error{background:#fff4f4;border-color:#f3d0d0;color:#9b1c1c}
    .revlo-allowance img{width:18px;height:18px;vertical-align:-4px;margin-right:4px}
  `;
  document.head.appendChild(style);

  function describe(data) {
    if (data.badge) {
      const badge = BADGE_NAMES[data.badge] || 'badge';
      return `<img src="/badges/${data.badge}.svg" alt=""><strong>${badge} badge:</strong> one publish link creates up to <strong>${data.postsPerLink} posts</strong>, with no time limit.`;
    }
    return `<strong>${data.postsPerLink} ${data.postsPerLink === 1 ? 'post' : 'posts'} per link.</strong> Each emailed link publishes up to ${data.postsPerLink} ${data.postsPerLink === 1 ? 'post' : 'posts'} and expires after ${data.timeLimitMinutes} minutes. Earn a Silver badge for links that publish ${data.silverLinkPosts || 50} posts with no time limit.`;
  }

  function mount(input) {
    if (input.dataset.revloAllowance === 'true') return;
    input.dataset.revloAllowance = 'true';
    const box = document.createElement('div');
    box.className = 'revlo-allowance';
    box.innerHTML = '<button type="button">Check posts available</button><div class="ra-result" hidden></div>';
    const button = box.querySelector('button');
    const result = box.querySelector('.ra-result');
    const sync = () => { button.disabled = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()); };
    input.addEventListener('input', sync);
    sync();
    button.addEventListener('click', async () => {
      button.disabled = true;
      result.hidden = false;
      result.className = 'ra-result';
      result.textContent = 'Checking…';
      try {
        const res = await fetch(`/api/publish-allowance?email=${encodeURIComponent(input.value.trim())}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not check right now.');
        result.innerHTML = describe(data);
      } catch (error) {
        result.className = 'ra-result ra-error';
        result.textContent = error.message;
      } finally {
        sync();
      }
    });
    input.insertAdjacentElement('afterend', box);
  }

  function scan() {
    const heading = [...document.querySelectorAll('h1,h2,h3')].find((h) => h.textContent.trim() === 'Create a post');
    const scope = heading?.closest('[role="dialog"]') || heading?.parentElement?.parentElement;
    const input = scope?.querySelector('input[type="email"]');
    if (input) mount(input);
  }

  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
