(() => {
  'use strict';
  const originalFetch = window.fetch.bind(window);
  const initial = new URLSearchParams(location.search);
  if (initial.get('token')) sessionStorage.setItem('revlo_publish_token', initial.get('token'));
  const state = { publisher: null, posts: new Map(), promotions: [], rotation: 0 };
  const token = () => sessionStorage.getItem('revlo_publish_token') || '';
  const money = (kobo) => `₦${Math.round(Number(kobo || 0) / 100).toLocaleString('en-NG')}`;

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/api/upload') && init.body instanceof FormData) {
      if (!init.body.has('publish_token')) init.body.append('publish_token', token());
      if (!init.body.has('poster_email') && state.publisher?.email) init.body.append('poster_email', state.publisher.email);
    }
    if (url === '/api/posts' && init.method === 'POST') {
      try {
        const body = JSON.parse(init.body);
        body.premium_payment_reference = savedReference('premium');
        body.promo_payment_reference = savedReference('promo');
        init = { ...init, body: JSON.stringify(body) };
      } catch {}
    }
    const response = await originalFetch(input, init);
    try {
      if (url.startsWith('/api/magic-link?') && response.ok) {
        const body = await response.clone().json();
        if (body.publisher) {
          state.publisher = { ...body.publisher, email: body.email };
          sessionStorage.setItem('revlo_publisher', JSON.stringify(state.publisher));
        }
      }
      if (url === '/api/posts' && init.method === 'POST' && response.ok) {
        // A promotion payment applies to exactly one post.
        clearReference('promo');
      }
      if (url.startsWith('/api/posts?') && response.ok) {
        const body = await response.clone().json();
        for (const post of body.posts || []) state.posts.set(post.uid, post);
        setTimeout(decoratePosts, 0);
      }
    } catch {}
    return response;
  };

  try { state.publisher = JSON.parse(sessionStorage.getItem('revlo_publisher')); } catch {}

  // Publish links usually open in a new tab, so paid references are kept in
  // localStorage (not per-tab sessionStorage). The server checks each one
  // against the paying email and marks promotions used, so this is not a secret.
  function savedReference(kind) {
    try { return localStorage.getItem(`revlo_${kind}_reference`) || sessionStorage.getItem(`revlo_${kind}_reference`) || null; } catch { return null; }
  }
  function saveReference(kind, reference) {
    try { localStorage.setItem(`revlo_${kind}_reference`, reference); } catch {}
    try { sessionStorage.setItem(`revlo_${kind}_reference`, reference); } catch {}
  }
  function clearReference(kind) {
    try { localStorage.removeItem(`revlo_${kind}_reference`); } catch {}
    try { sessionStorage.removeItem(`revlo_${kind}_reference`); } catch {}
  }

  async function verifyPayment(reference) {
    const verify = await originalFetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish_token: token(), reference }) });
    return verify.json().catch(() => ({}));
  }

  function paymentNotice(text) {
    const note = document.createElement('div');
    note.setAttribute('role', 'status');
    note.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:10000;max-width:92vw;padding:13px 18px;border-radius:14px;background:#1b5e20;color:#fff;font:600 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.25)';
    note.textContent = text;
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 6000);
  }

  // Returning from Paystack (/app.html?payment=REF): in the payment pop-up,
  // or after a full-page redirect when the pop-up was blocked.
  const returnedReference = initial.get('payment');
  if (returnedReference) {
    history.replaceState(null, '', location.pathname);
    const inPopup = window.name === 'revlo-payment' && window.opener && !window.opener.closed;
    verifyPayment(returnedReference).then((result) => {
      if (inPopup) {
        document.body.innerHTML = '<div style="font:16px system-ui;padding:40px;text-align:center">' + (result.paid ? '<strong>Payment received.</strong><br>You can close this window and return to Revlo.' : 'Payment not confirmed yet. Return to Revlo and choose “Check payment again”.') + '</div>';
        setTimeout(() => window.close(), 1500);
        return;
      }
      if (!result.paid) { paymentNotice('We could not confirm that payment yet. If you were charged, it will be applied automatically within a few minutes.'); return; }
      if (result.kind === 'premium' || result.kind === 'promo') saveReference(result.kind, returnedReference);
      try { sessionStorage.removeItem('revlo_pending_payment'); } catch {}
      if (token()) location.replace(`/app.html?token=${encodeURIComponent(token())}&paid=${result.kind}`);
      else paymentNotice(result.kind === 'promo' ? 'Payment received. Open your publish link to publish the promoted post.' : 'Premium Green is active.');
    }).catch(() => paymentNotice('We could not check the payment. Please refresh the page.'));
  }
  if (initial.get('paid')) {
    history.replaceState(null, '', `${location.pathname}?token=${encodeURIComponent(initial.get('token') || '')}`);
    setTimeout(() => paymentNotice(initial.get('paid') === 'promo' ? 'Payment received. Your next post will be promoted when you publish it.' : 'Payment received. Premium Green is active.'), 800);
  }

  async function pay(kind, promoDays, button) {
    button.disabled = true;
    button.textContent = 'Opening secure payment…';
    // Open the window synchronously in the click so browsers (notably iPhone
    // Safari) don't block it; it is pointed at Paystack once the payment starts.
    let popup = null;
    try { popup = window.open('', 'revlo-payment', 'width=520,height=760'); } catch {}
    try { popup?.document.write('<p style="font:16px system-ui;padding:32px;text-align:center">Opening secure Paystack payment…</p>'); } catch {}
    try {
      const response = await originalFetch('/api/payments/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish_token: token(), kind, promo_days: promoDays }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payment could not start');
      try { sessionStorage.setItem('revlo_pending_payment', JSON.stringify({ kind, reference: data.reference })); } catch {}
      if (popup && !popup.closed) popup.location.href = data.authorization_url;
      else { location.href = data.authorization_url; return; }
      button.textContent = 'Waiting for payment…';
      let tries = 0;
      const timer = setInterval(async () => {
        tries += 1;
        const result = await verifyPayment(data.reference);
        if (result.paid) {
          clearInterval(timer); popup?.close();
          saveReference(kind, data.reference);
          try { sessionStorage.removeItem('revlo_pending_payment'); } catch {}
          button.textContent = kind === 'premium' ? '✓ Premium Green active' : '✓ Promotion ready';
          button.style.background = '#087a45';
        } else if (tries >= 100) {
          clearInterval(timer); button.disabled = false; button.textContent = 'Check payment again';
        }
      }, 3000);
    } catch (error) { try { popup?.close(); } catch {} button.disabled = false; button.textContent = error.message; }
  }

  function featurePanel(modal) {
    if (modal.querySelector('.revlo-feature-panel') || !state.publisher) return;
    const publish = [...modal.querySelectorAll('button')].find((b) => /publish/i.test(b.textContent));
    if (!publish) return;
    const s = state.publisher.settings;
    const posts = Number(state.publisher.publishedPosts) || 0;
    const rank = { silver: 1, bronze: 2, gold: 3 }[state.publisher.trustBadge] || 0;
    const tiers = [
      // ORIGINAL (commented out 2026-09-29):
      // { key: 'silver', name: 'Silver', posts: s.silver_posts, unlocks: 'Video posts and 2-month posts' },
      // { key: 'bronze', name: 'Bronze', posts: s.bronze_posts, unlocks: 'A stronger trust mark on every post' },
      // { key: 'gold', name: 'Gold', posts: s.gold_posts, unlocks: '3-month posts and the top trust mark' },
      // NOTE: each badge now also gives a multi-post publish link with no time limit
      // (src/lib/revloFeatures.js PUBLISH_LINK_ALLOWANCE). Without a badge, a link is one post within 30 minutes.
      { key: 'silver', name: 'Silver', posts: s.silver_posts, unlocks: `Video posts, 2-month posts, and publish links for ${s.silver_link_posts || 50} posts with no time limit` },
      { key: 'bronze', name: 'Bronze', posts: s.bronze_posts, unlocks: `A stronger trust mark on every post, and publish links for ${s.bronze_link_posts || 100} posts with no time limit` },
      { key: 'gold', name: 'Gold', posts: s.gold_posts, unlocks: `3-month posts, the top trust mark, and publish links for ${s.gold_link_posts || 200} posts with no time limit` },
    ].map((tier, index) => ({ ...tier, earned: rank >= index + 1 || posts >= tier.posts }));
    const current = [...tiers].reverse().find((tier) => tier.earned);
    const next = tiers.find((tier) => !tier.earned);
    const progress = next ? Math.min(100, Math.round((posts / next.posts) * 100)) : 100;
    const summary = next
      ? `${current ? `${current.name} · ` : ''}${posts} of ${next.posts} posts to ${next.name}`
      : 'Gold · every badge earned';
    let open = false;
    try { open = localStorage.getItem('revlo_standing_open') === '1'; } catch {}
    const panel = document.createElement('details');
    panel.className = 'revlo-feature-panel';
    panel.open = open;
    panel.addEventListener('toggle', () => { try { localStorage.setItem('revlo_standing_open', panel.open ? '1' : '0'); } catch {} });
    panel.innerHTML = `<style>
      .revlo-feature-panel{margin:18px 0;border:1px solid #d8e7d9;border-radius:16px;background:linear-gradient(145deg,#f8fff8,#fff);font:14px system-ui;color:#233128}
      .revlo-feature-panel>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer}
      .revlo-feature-panel>summary::-webkit-details-marker{display:none}
      .revlo-feature-panel>summary img{width:30px;height:30px;flex:none}
      .revlo-feature-panel>summary .rv-title{display:block;font-weight:800;font-size:15px}
      .revlo-feature-panel>summary .rv-sub{display:block;font-size:12px;color:#637067;margin-top:2px}
      .revlo-feature-panel>summary .rv-chev{margin-left:auto;transition:transform .2s;color:#637067}
      .revlo-feature-panel[open]>summary .rv-chev{transform:rotate(180deg)}
      .revlo-feature-panel .rv-bar{height:6px;border-radius:9px;background:#e3ece4;overflow:hidden;margin:0 16px 12px}
      .revlo-feature-panel .rv-bar span{display:block;height:100%;background:#1b5e20;border-radius:9px}
      .revlo-feature-panel .rv-body{padding:0 16px 16px}
      .revlo-feature-panel p{margin:5px 0;color:#637067}
      .revlo-feature-panel button{border:0;border-radius:10px;background:#1b5e20;color:white;font-weight:800;padding:11px 14px;cursor:pointer}
      .revlo-feature-panel select{padding:9px;border:1px solid #ccd7cd;border-radius:9px}
      .revlo-feature-panel .rv-ladder{list-style:none;margin:4px 0 10px;padding:0;display:grid;gap:8px}
      .revlo-feature-panel .rv-ladder li{display:flex;gap:11px;align-items:center;padding:9px 10px;border-radius:12px;background:#fff;border:1px solid #e3ece4}
      .revlo-feature-panel .rv-ladder img{width:34px;height:34px;flex:none;filter:drop-shadow(0 2px 3px #0002)}
      .revlo-feature-panel .rv-ladder li.rv-locked img{filter:grayscale(1);opacity:.45}
      .revlo-feature-panel .rv-ladder strong{display:block;font-size:14px}
      .revlo-feature-panel .rv-ladder small{display:block;color:#637067;font-size:12px;line-height:1.35}
      .revlo-feature-panel .rv-status{margin-left:auto;font-size:11px;font-weight:800;white-space:nowrap;color:#637067}
      .revlo-feature-panel .rv-earned .rv-status{color:#1b5e20}
      .revlo-feature-panel .rv-note{font-size:12px}
      .revlo-feature-panel .revlo-premium,.revlo-feature-panel .revlo-promo{margin-top:12px;padding-top:12px;border-top:1px solid #e3ece4}
      .revlo-badge-line{display:flex;gap:9px;align-items:center;margin:6px 0}
      .revlo-badge-line img{width:34px;height:34px;filter:drop-shadow(0 3px 4px #0003)}
    </style>
    <summary><img src="/badges/${current ? current.key : 'silver'}.svg" alt="" style="${current ? '' : 'filter:grayscale(1);opacity:.45'}"><span><span class="rv-title">Your Revlo standing</span><span class="rv-sub">${summary}</span></span><span class="rv-chev" aria-hidden="true">▾</span></summary>
    <div class="rv-bar" role="progressbar" aria-label="Progress to next badge" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>
    <div class="rv-body">
      <ul class="rv-ladder">${tiers.map((tier) => `<li class="${tier.earned ? 'rv-earned' : 'rv-locked'}"><img src="/badges/${tier.key}.svg" alt=""><span><strong>${tier.name} · ${Number(tier.posts).toLocaleString('en-NG')} posts</strong><small>Unlocks: ${tier.unlocks}</small></span><span class="rv-status">${tier.earned ? '✓ Earned' : `${Math.max(0, tier.posts - posts).toLocaleString('en-NG')} to go`}</span></li>`).join('')}</ul>
      <p class="rv-note">Every post you publish through an emailed Revlo link counts towards your badges. Earned badges appear on your posts so people know you're an established publisher.</p>
      <p class="rv-note">Publish links: without a badge, each emailed link publishes one post and expires after 30 minutes. With a badge, one link publishes ${s.silver_link_posts || 50} (Silver), ${s.bronze_link_posts || 100} (Bronze) or ${s.gold_link_posts || 200} (Gold) posts and does not expire with time. Requesting a new link cancels the previous one.</p>
      <div class="revlo-premium"><div class="revlo-badge-line"><img src="/badges/premium-green.svg" alt="Premium Green"><strong>Premium Green · ${money(s.premium_price_kobo)} for ${s.premium_days} days</strong></div><p>A paid green badge on all your posts for ${s.premium_days} days.</p></div>
      <div class="revlo-promo"><strong>Promote this post</strong><p>Rotates at the top and throughout every category every 20 seconds.</p><select aria-label="Promotion duration"></select> <button type="button">Pay & promote</button></div>
    </div>`;
    // Sit just above the pinned publish footer so the panel scrolls with the
    // form instead of covering it when expanded.
    const footer = publish.parentElement;
    const pinned = footer && getComputedStyle(footer).position === 'sticky';
    if (pinned && footer.parentElement) footer.parentElement.insertBefore(panel, footer);
    else footer.insertBefore(panel, publish);
    const premium = panel.querySelector('.revlo-premium');
    if (state.publisher.premiumActive) premium.insertAdjacentHTML('beforeend', '<p><strong>✓ Active</strong></p>');
    else if (state.publisher.premiumEligible) { const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Get Premium Green'; b.onclick = () => pay('premium', null, b); premium.appendChild(b); }
    else premium.insertAdjacentHTML('beforeend', `<p>Available after ${s.premium_min_posts} posts.</p>`);
    const promo = panel.querySelector('.revlo-promo');
    if (!s.promotions_enabled) promo.innerHTML = '<strong>Promotions are currently paused by Revlo.</strong>';
    else {
      const select = promo.querySelector('select');
      for (let day = s.promo_min_days; day <= s.promo_max_days; day++) { const o = document.createElement('option'); o.value = day; o.textContent = `${day} day${day === 1 ? '' : 's'} · ${money(s.promo_price_per_day_kobo * day)}`; select.appendChild(o); }
      const b = promo.querySelector('button'); b.onclick = () => pay('promo', Number(select.value), b);
    }
    const record = [...modal.querySelectorAll('button')].find((b) => /Record a 20-second video/.test(b.textContent));
    if (record && !state.publisher.videoEligible) { record.disabled = true; record.style.opacity = '.48'; record.title = `Silver badge required (${s.silver_posts} posts)`; }
  }

  function decoratePosts() {
    for (const [uid, post] of state.posts) {
      const card = document.getElementById(`post-${uid}`);
      if (!card || card.querySelector('.revlo-badges')) continue;
      const badges = document.createElement('div'); badges.className = 'revlo-badges';
      badges.style.cssText = 'position:absolute;top:12px;left:12px;display:flex;gap:6px;z-index:5';
      if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
      if (post.trust_badge) badges.innerHTML += `<img src="/badges/${post.trust_badge}.svg" title="${post.trust_badge} trusted publisher" style="width:38px;height:38px;filter:drop-shadow(0 2px 4px #0006)">`;
      if (post.premium_badge) badges.innerHTML += '<img src="/badges/premium-green.svg" title="Premium Green publisher" style="width:38px;height:38px;filter:drop-shadow(0 2px 4px #0006)">';
      if (badges.children.length) card.appendChild(badges);
    }
  }

  function promoElement(promo, compact = false) {
    const post = promo.posts || {};
    const href = promo.target_url || (promo.post_uid ? `/p/${promo.post_uid}` : '#');
    const node = document.createElement('a'); node.href = href; node.className = 'revlo-promotion';
    node.style.cssText = `display:flex;gap:14px;align-items:center;text-decoration:none;color:#15251a;background:linear-gradient(125deg,#ecfff0,#fff8d8);border:1px solid #8bcc97;border-radius:16px;padding:${compact ? '10px' : '14px'};margin:0 0 18px;box-shadow:0 8px 25px #1b5e2014`;
    const image = promo.image_url || post.header_url || post.thumb_url;
    if (image) {
      const img = document.createElement('img'); img.src = image; img.alt = '';
      img.style.cssText = `width:${compact ? 72 : 104}px;height:${compact ? 54 : 74}px;object-fit:cover;border-radius:10px`;
      node.appendChild(img);
    }
    const copy = document.createElement('div');
    const label = document.createElement('small'); label.textContent = 'PROMOTED'; label.style.cssText = 'font-weight:900;color:#1b5e20;letter-spacing:.08em';
    const title = document.createElement('strong'); title.textContent = promo.title || post.title || 'Featured on Revlo'; title.style.cssText = `display:block;font-size:${compact ? 15 : 18}px;margin:3px 0`;
    const description = document.createElement('span'); description.textContent = promo.description || post.description || ''; description.style.color = '#657269';
    copy.append(label, title, description); node.appendChild(copy);
    return node;
  }
  function headerPromoElement(promo) {
    const post = promo.posts || {};
    const href = promo.target_url || (promo.post_uid ? `/p/${promo.post_uid}` : '#');
    const node = document.createElement('a');
    node.href = href;
    node.className = 'revlo-header-ad-slot';
    node.setAttribute('aria-label', `Advert: ${promo.title || post.title || 'Featured on Revlo'}`);
    const image = promo.image_url || post.header_url || post.thumb_url;
    if (image) {
      const img = document.createElement('img'); img.src = image; img.alt = '';
      node.appendChild(img);
    }
    const copy = document.createElement('span'); copy.className = 'revlo-header-ad-copy';
    const label = document.createElement('small'); label.textContent = 'ADVERT';
    const title = document.createElement('strong'); title.textContent = promo.title || post.title || 'Featured on Revlo';
    const description = document.createElement('span'); description.textContent = promo.description || post.description || '';
    copy.append(label, title, description); node.appendChild(copy);
    return node;
  }
  function renderHeaderPromotion(headerPromotions) {
    document.querySelectorAll('.revlo-header-ad-slot').forEach((node) => node.remove());
    if (!headerPromotions.length) return;
    const header = document.querySelector('header');
    const logo = header?.querySelector('img[alt*="revlo.ng"]');
    const firstRow = logo?.parentElement;
    if (!firstRow) return;
    const promo = headerPromotions[state.rotation % headerPromotions.length];
    firstRow.appendChild(headerPromoElement(promo));
  }
  function renderPromotions() {
    document.querySelectorAll('.revlo-promotion').forEach((n) => n.remove());
    const headerPromotions = state.promotions.filter((promo) => promo.placement === 'header' && promo.source === 'admin');
    const feedPromotions = state.promotions.filter((promo) => promo.placement !== 'header');
    renderHeaderPromotion(headerPromotions);
    if (!feedPromotions.length) return;
    const promo = feedPromotions[state.rotation % feedPromotions.length];
    const grid = document.querySelector('main > div[style*="grid-template-columns"]');
    if (!grid) return;
    grid.parentElement.insertBefore(promoElement(promo), grid);
    [...grid.children].forEach((card, index) => { if ((index + 1) % 6 === 0) card.after(promoElement(promo, true)); });
  }

  async function loadPromotions() {
    try { const r = await originalFetch('/api/promotions', { cache: 'no-store' }); state.promotions = (await r.json()).promotions || []; renderPromotions(); } catch {}
  }
  const observer = new MutationObserver(() => {
    decoratePosts();
    if (!document.querySelector('.revlo-header-ad-slot') && state.promotions.some((promo) => promo.placement === 'header' && promo.source === 'admin')) renderPromotions();
    const headings = [...document.querySelectorAll('h1,h2,h3')];
    const newPost = headings.find((h) => h.textContent.trim() === 'New post');
    if (newPost) featurePanel(newPost.closest('[role="dialog"]') || newPost.parentElement?.parentElement || document.body);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  loadPromotions();
  setInterval(() => { if (state.promotions.length > 1) { state.rotation += 1; renderPromotions(); } }, 20000);

  const promotionStyles = document.createElement('style');
  promotionStyles.textContent = `
    .revlo-header-ad-slot{position:absolute;left:270px;right:210px;top:6px;min-height:78px;display:flex;align-items:center;gap:12px;padding:8px 13px;border:1px solid #a9d6af;border-radius:15px;background:linear-gradient(120deg,#f0fff2,#fff9df);box-shadow:0 8px 24px rgba(22,128,61,.10);color:#17251b;text-decoration:none;overflow:hidden;z-index:2}
    .revlo-header-ad-slot:hover{border-color:#16803d;box-shadow:0 10px 28px rgba(22,128,61,.16)}
    .revlo-header-ad-slot>img{width:112px;height:64px;object-fit:cover;border-radius:10px;flex:none}
    .revlo-header-ad-copy{display:block;min-width:0;line-height:1.2}
    .revlo-header-ad-copy small{display:block;color:#16803d;font:900 10px/1.1 system-ui;letter-spacing:.12em;margin-bottom:4px}
    .revlo-header-ad-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 15px/1.2 system-ui}
    .revlo-header-ad-copy>span{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#667085;font:12px/1.3 system-ui;margin-top:3px}
    html[data-revlo-theme="dark"] .revlo-header-ad-slot{background:linear-gradient(120deg,#13271a,#292615);border-color:#356643;color:#f4fbf5}
    html[data-revlo-theme="dark"] .revlo-header-ad-copy>span{color:#c8d3ca}
    @media(max-width:980px){.revlo-header-ad-slot{display:none}}
  `;
  document.head.appendChild(promotionStyles);
})();
