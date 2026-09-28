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
        body.premium_payment_reference = sessionStorage.getItem('revlo_premium_reference') || null;
        body.promo_payment_reference = sessionStorage.getItem('revlo_promo_reference') || null;
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
      if (url.startsWith('/api/posts?') && response.ok) {
        const body = await response.clone().json();
        for (const post of body.posts || []) state.posts.set(post.uid, post);
        setTimeout(decoratePosts, 0);
      }
    } catch {}
    return response;
  };

  try { state.publisher = JSON.parse(sessionStorage.getItem('revlo_publisher')); } catch {}

  async function pay(kind, promoDays, button) {
    button.disabled = true;
    button.textContent = 'Opening secure payment…';
    try {
      const response = await originalFetch('/api/payments/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish_token: token(), kind, promo_days: promoDays }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Payment could not start');
      const popup = window.open(data.authorization_url, 'revlo-payment', 'width=520,height=760');
      if (!popup) location.href = data.authorization_url;
      button.textContent = 'Waiting for payment…';
      let tries = 0;
      const timer = setInterval(async () => {
        tries += 1;
        const verify = await originalFetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish_token: token(), reference: data.reference }) });
        const result = await verify.json().catch(() => ({}));
        if (result.paid) {
          clearInterval(timer); popup?.close();
          sessionStorage.setItem(`revlo_${kind}_reference`, data.reference);
          button.textContent = kind === 'premium' ? '✓ Premium Green active' : '✓ Promotion ready';
          button.style.background = '#087a45';
        } else if (tries >= 100) {
          clearInterval(timer); button.disabled = false; button.textContent = 'Check payment again';
        }
      }, 3000);
    } catch (error) { button.disabled = false; button.textContent = error.message; }
  }

  function featurePanel(modal) {
    if (modal.querySelector('.revlo-feature-panel') || !state.publisher) return;
    const publish = [...modal.querySelectorAll('button')].find((b) => /Publish/.test(b.textContent));
    if (!publish) return;
    const s = state.publisher.settings;
    const panel = document.createElement('section');
    panel.className = 'revlo-feature-panel';
    panel.innerHTML = `<style>
      .revlo-feature-panel{margin:18px 0;padding:16px;border:1px solid #d8e7d9;border-radius:16px;background:linear-gradient(145deg,#f8fff8,#fff);font:14px system-ui;color:#233128}.revlo-feature-panel h3{margin:0 0 7px;font-size:16px}.revlo-feature-panel p{margin:5px 0;color:#637067}.revlo-feature-panel button{border:0;border-radius:10px;background:#1b5e20;color:white;font-weight:800;padding:11px 14px;cursor:pointer}.revlo-feature-panel select{padding:9px;border:1px solid #ccd7cd;border-radius:9px}.revlo-badge-line{display:flex;gap:9px;align-items:center;margin:10px 0}.revlo-badge-line img{width:38px;height:38px;filter:drop-shadow(0 3px 4px #0003)}
    </style><h3>Your community standing</h3><div class="revlo-badge-line">${['silver','bronze','gold'].map((b) => `<img src="/badges/${b}.svg" alt="${b}">`).join('')}<strong>${state.publisher.publishedPosts} verified posts</strong></div>
    <p>Silver at ${s.silver_posts} posts unlocks video. Bronze at ${s.bronze_posts}; Gold at ${s.gold_posts}.</p>
    <div class="revlo-premium"><div class="revlo-badge-line"><img src="/badges/premium-green.svg" alt="Premium Green"><strong>Premium Green · ${money(s.premium_price_kobo)} for ${s.premium_days} days</strong></div></div>
    <div class="revlo-promo"><strong>Promote this post</strong><p>Rotates at the top and throughout every category every 20 seconds.</p><select aria-label="Promotion duration"></select> <button type="button">Pay & promote</button></div>`;
    publish.parentElement.insertBefore(panel, publish);
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
  function renderPromotions() {
    document.querySelectorAll('.revlo-promotion').forEach((n) => n.remove());
    if (!state.promotions.length) return;
    const promo = state.promotions[state.rotation % state.promotions.length];
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
    const headings = [...document.querySelectorAll('h1,h2,h3')];
    const newPost = headings.find((h) => h.textContent.trim() === 'New post');
    if (newPost) featurePanel(newPost.closest('[role="dialog"]') || newPost.parentElement?.parentElement || document.body);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  loadPromotions();
  setInterval(() => { if (state.promotions.length > 1) { state.rotation += 1; renderPromotions(); } }, 20000);
})();
