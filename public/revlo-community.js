(() => {
  'use strict';
  // Follow reasons and poster aliases (2026-09-30).
  // 1. The "Follow this poster" window gets an optional note: why are you following?
  // 2. Notes appear under the poster's posts: the newest one, the total, and a
  //    button to reveal the rest. Follower emails are never shown.
  // 3. The "New post" form gets an alias field, pre-filled with the publisher's
  //    current alias; clearing it removes the alias.
  // 4. The alias appears before the city on each post, e.g. "📍 Billy Lagos, Nigeria".
  // 5. Uploaded images (header and gallery, and their enlarged views) carry a
  //    clear "With @Billy" watermark. It is drawn over the image rather than
  //    burned into the file, so it always matches the current alias.
  const REASON_MAX = 200;
  const ALIAS_MAX = 24;
  const aliases = new Map(); // post uid -> alias
  const imageAlias = new Map(); // image URL -> alias, for enlarged views outside the card
  const reasons = new Map(); // post uid -> { count, reasons }
  const requested = new Set();
  let currentTags = [];
  let suspendedUntil = 0;

  const style = document.createElement('style');
  style.textContent = `
    .rv-reason-field{margin:2px 0 14px;text-align:left}
    .rv-reason-field label{display:block;font:700 14px/1.3 system-ui;color:#1f3b24;margin-bottom:4px}
    .rv-reason-field .rv-hint{font:12.5px/1.45 system-ui;color:#5f6b61;margin:0 0 8px}
    .rv-reason-field textarea{width:100%;box-sizing:border-box;min-height:74px;resize:vertical;border:1.5px solid #cfd8cc;border-radius:14px;padding:12px 14px;font:15px/1.45 system-ui;background:#fff;color:#1a1a1a}
    .rv-reason-field textarea:focus{outline:none;border-color:#2e7d32;box-shadow:0 0 0 3px rgba(46,125,50,.14)}
    .rv-reason-field .rv-count{text-align:right;font:11.5px system-ui;color:#8a948b;margin-top:3px}
    .rv-why{margin:0 0 10px;font:13.5px/1.45 system-ui;color:#2b332c;min-width:0}
    .rv-why-head{display:flex;align-items:baseline;gap:6px;font:700 12.5px/1.4 system-ui;color:#2e5e32}
    .rv-why-head .rv-why-more{margin-left:auto}
    .rv-why-head span{color:#6b756c;font-weight:600}
    .rv-why-line{display:flex;align-items:baseline;gap:8px;min-width:0}
    .rv-why-line q{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic;color:#3b443c}
    .rv-why-more{flex:none;border:0;background:none;color:#1b5e20;font:700 12.5px system-ui;cursor:pointer;padding:0;white-space:nowrap}
    .rv-why-list{margin:4px 0 0;padding:0;list-style:none}
    .rv-why-list li{padding:4px 0 4px 10px;border-left:2px solid #9fcca1;margin-top:4px;font-style:italic;color:#3b443c}
    .rv-why-list small{display:block;font-style:normal;color:#7b867c;font-size:11px}
    .rv-alias{color:#1b5e20;font-weight:800;margin-right:5px}
    .rv-alias-field{margin:6px 0 12px}
    .rv-alias-field label{display:block;font:700 13px system-ui;color:#1f3b24;margin-bottom:5px}
    .rv-alias-field input{width:100%;max-width:320px;box-sizing:border-box;border:1.5px solid #d5dcd6;border-radius:999px;padding:9px 14px;font:14px system-ui;background:#fff}
    .rv-alias-field input:focus{outline:none;border-color:#2e7d32}
    .rv-alias-field .rv-hint{font:12px/1.45 system-ui;color:#6b756c;margin-top:5px}
    .rv-alias-field .rv-hint.rv-bad{color:#b42318}
    .rv-follower-name{border:0;background:none;padding:0;color:#1b5e20;font:700 11.5px system-ui;text-decoration:underline;cursor:pointer;font-style:normal}
    .rv-cf-back{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
    .rv-cf{width:100%;max-width:440px;background:#fffdf5;border-radius:22px;padding:22px;box-shadow:0 18px 50px rgba(0,0,0,.3);font:15px/1.45 system-ui;color:#1a1a1a}
    .rv-cf h2{margin:0 0 6px;font-size:21px}.rv-cf p{margin:0 0 12px;color:#555;font-size:14px}
    .rv-cf input,.rv-cf textarea{width:100%;box-sizing:border-box;border:1.5px solid #cfd8cc;border-radius:14px;padding:12px 14px;font:15px system-ui;margin-bottom:10px;background:#fff}
    .rv-cf label.rv-robot{display:flex;align-items:center;gap:10px;border:1.5px solid #cfd8cc;border-radius:14px;padding:12px 14px;margin-bottom:10px}
    .rv-cf .rv-cf-actions{display:flex;gap:8px}.rv-cf button{border:0;border-radius:14px;padding:12px 16px;font:800 15px system-ui;cursor:pointer}
    .rv-cf .rv-send{flex:1;background:#1b5e20;color:#fff}.rv-cf .rv-send:disabled{opacity:.5}.rv-cf .rv-cancel{background:#eef1ec;color:#333}
    .rv-cf .rv-cf-msg{margin-top:10px;font-weight:600}
    .rv-tags-field{margin:6px 0 12px}.rv-tags-field label{display:block;font:700 13px system-ui;color:#1f3b24;margin-bottom:5px}
    .rv-tags-box{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:1.5px solid #d5dcd6;border-radius:14px;padding:6px 8px;background:#fff;max-width:420px}
    .rv-tags-box span{background:#eef6ef;color:#1b5e20;border-radius:999px;padding:4px 8px;font:700 12.5px system-ui}
    .rv-tags-box span button{border:0;background:none;color:#1b5e20;cursor:pointer;margin-left:4px;font-weight:800}
    .rv-tags-box input{border:0;outline:none;flex:1;min-width:110px;font:14px system-ui;padding:5px}
    .rv-rule-note{margin:4px 0 12px;padding:10px 12px;border-radius:12px;background:#fff8e6;border:1px solid #f1d58a;color:#6b4e00;font:13px/1.45 system-ui}
    .rv-suspended{margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#fdecea;border:1px solid #f3b4ad;border-left:5px solid #b42318;color:#7a1a12;font:14px/1.5 system-ui}
    .rv-suspended strong{display:block;font-size:15px}
    .rv-wm{position:absolute;right:14px;bottom:16px;z-index:3;pointer-events:none;user-select:none;padding:6px 12px;border-radius:999px;background:rgba(0,0,0,.52);color:#fff;font:800 15px/1 system-ui;letter-spacing:.01em;text-shadow:0 1px 2px rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(2px)}
    .rv-wm.rv-wm-sm{right:4px;bottom:4px;padding:3px 6px;font-size:10px}
  `;
  document.head.appendChild(style);

  const ago = (iso) => {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  };
  const publisher = () => { try { return JSON.parse(sessionStorage.getItem('revlo_publisher')) || null; } catch { return null; } };

  // Send the note with the follow request, and the alias with a new post.
  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (init.method === 'POST' && typeof init.body === 'string' && (url === '/api/follow' || url === '/api/posts')) {
      try {
        const body = JSON.parse(init.body);
        if (url === '/api/follow') {
          const note = document.querySelector('.rv-reason-field textarea');
          if (note && note.value.trim()) body.reason = note.value.trim();
          // NOTE (2026-10-01): the follower's own alias, so the poster can contact them.
          const followerAlias = document.querySelector('.rv-reason-field input');
          if (followerAlias && followerAlias.value.trim()) body.follower_alias = followerAlias.value.trim();
        } else {
          const alias = document.querySelector('.rv-alias-field input');
          if (alias) body.poster_alias = alias.value.trim();
          if (document.querySelector('.rv-tags-field')) body.tags = [...currentTags];
        }
        init = { ...init, body: JSON.stringify(body) };
      } catch {}
    }
    const response = await previousFetch(input, init);
    try {
      // NOTE (2026-10-01): a suspended publisher gets a countdown in the post window.
      if ((url === '/api/magic-link' || url === '/api/posts') && response.status === 403) {
        const data = await response.clone().json();
        if (data?.suspended_until) { suspendedUntil = Date.parse(data.suspended_until); setTimeout(scan, 0); }
      }
      if ((url.startsWith('/api/posts?') || url === '/api/posts') && response.ok) {
        const data = await response.clone().json();
        for (const post of data.posts || (data.post ? [data.post] : [])) aliases.set(post.uid, post.poster_alias || '');
        if (data.post) {
          const stored = publisher();
          if (stored) sessionStorage.setItem('revlo_publisher', JSON.stringify({ ...stored, alias: data.post.poster_alias || null }));
        }
        setTimeout(scan, 0);
      }
    } catch {}
    return response;
  };

  function headingIn(text) {
    return [...document.querySelectorAll('h1,h2,h3')].find((h) => h.textContent.trim() === text);
  }

  // 1. Follow window
  function mountReasonField() {
    const heading = headingIn('Follow this poster');
    const scope = heading?.closest('[role="dialog"]') || heading?.parentElement?.parentElement;
    const email = scope?.querySelector('input[type="email"], input[placeholder="Your email address"]');
    if (!email || scope.querySelector('.rv-reason-field')) return;
    const box = document.createElement('div');
    box.className = 'rv-reason-field';
    box.innerHTML = `<label for="rv-reason">What made you follow? <span style="font-weight:500;color:#7b867c">(optional)</span></label>
      <p class="rv-hint">Share a few words about why this poster is worth following. Your note appears under their posts to help others decide. Your email is never shown.</p>
      <textarea id="rv-reason" maxlength="${REASON_MAX}" placeholder="e.g. Honest seller, quick to reply and the prices were fair."></textarea>
      <div class="rv-count">0 / ${REASON_MAX}</div>
      <label for="rv-follower-alias" style="margin-top:10px">Your alias <span style="font-weight:500;color:#7b867c">(optional)</span></label>
      <p class="rv-hint">Add the alias you publish under so this poster can send you messages. Followers without an alias cannot be contacted.</p>
      <input id="rv-follower-alias" maxlength="24" autocomplete="nickname" placeholder="e.g. Billy" style="width:100%;box-sizing:border-box;border:1.5px solid #cfd8cc;border-radius:14px;padding:11px 14px;font:15px system-ui;background:#fff">`;
    const area = box.querySelector('textarea');
    area.addEventListener('input', () => { box.querySelector('.rv-count').textContent = `${area.value.length} / ${REASON_MAX}`; });
    email.insertAdjacentElement('afterend', box);
  }

  // 2. Notes under posts
  function requestReasons(uids) {
    const wanted = uids.filter((uid) => !requested.has(uid));
    if (!wanted.length) return;
    wanted.forEach((uid) => requested.add(uid));
    for (let i = 0; i < wanted.length; i += 50) {
      previousFetch(`/api/follow-reasons?uids=${encodeURIComponent(wanted.slice(i, i + 50).join(','))}`)
        .then((r) => r.json())
        .then((data) => {
          for (const [uid, value] of Object.entries(data.reasons || {})) {
            reasons.set(uid, value);
            if (!aliases.has(uid)) aliases.set(uid, value.alias || '');
          }
          scan();
        })
        .catch(() => {});
    }
  }

  function footerOf(card) {
    return [...card.querySelectorAll('div')].reverse().find((div) =>
      [...div.children].some((child) => /Auto-deletes when time runs out|Expiring soon/.test(child.textContent || '')));
  }

  // Two lines when closed: "Why people follow (4)", then the newest note cut
  // to one line with "Show more" beside it. Opening shows every note in full.
  function renderReasons(card, uid) {
    const data = reasons.get(uid);
    if (!data || !data.count || card.querySelector('.rv-why')) return;
    const footer = footerOf(card);
    if (!footer) return;
    const box = document.createElement('div');
    box.className = 'rv-why';
    const head = document.createElement('div');
    head.className = 'rv-why-head';
    head.append('Why people follow ');
    const count = document.createElement('span');
    count.textContent = `(${data.count})`;
    head.appendChild(count);
    const line = document.createElement('div');
    line.className = 'rv-why-line';
    const first = document.createElement('q');
    // NOTE (2026-10-01): entries may be alias-only (no note).
    const firstNote = data.reasons.find((r) => r.text) || data.reasons[0];
    first.textContent = firstNote.text || `${firstNote.alias} follows`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rv-why-more';
    button.textContent = 'Show more ▾';
    button.setAttribute('aria-expanded', 'false');
    line.append(first, button);
    const list = document.createElement('ul');
    list.className = 'rv-why-list';
    list.hidden = true;
    for (const reason of data.reasons) {
      const li = document.createElement('li');
      li.textContent = reason.text ? `“${reason.text}”` : 'Follows this publisher';
      const when = document.createElement('small');
      if (reason.alias) {
        // The poster clicks a follower's alias to message them.
        const who = document.createElement('button');
        who.type = 'button';
        who.className = 'rv-follower-name';
        who.textContent = reason.alias;
        who.title = `Message ${reason.alias} (post creator only)`;
        who.addEventListener('click', (event) => { event.stopPropagation(); openContactFollower(uid, reason.alias); });
        when.append(who, ` · ${ago(reason.at)}`);
      } else {
        when.textContent = `A follower · ${ago(reason.at)}`;
      }
      li.appendChild(when);
      list.appendChild(li);
    }
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = list.hidden;
      list.hidden = !open;
      first.hidden = open;
      button.textContent = open ? 'Show less ▴' : 'Show more ▾';
      button.setAttribute('aria-expanded', String(open));
      if (open) head.appendChild(button); else line.appendChild(button);
    });
    box.append(head, line, list);
    footer.parentElement.insertBefore(box, footer);
  }

  // 4. Alias before the city
  function renderAlias(card, uid) {
    const alias = aliases.get(uid);
    const existing = card.querySelector('.rv-alias');
    if (existing && existing.dataset.alias === (alias || '')) return;
    existing?.remove();
    if (!alias) return;
    const pin = [...card.querySelectorAll('span')].find((span) => span.firstChild?.nodeType === 3 && span.firstChild.nodeValue.startsWith('\u{1F4CD}'));
    if (!pin) return;
    const label = document.createElement('span');
    label.className = 'rv-alias';
    label.dataset.alias = alias;
    label.textContent = alias;
    // Place it right after the pin, whether the city is a separate text piece or not.
    const pinText = pin.firstChild;
    const cut = pinText.nodeValue.indexOf(' ') + 1;
    if (cut > 0 && cut < pinText.nodeValue.length) pinText.splitText(cut);
    pin.insertBefore(label, pinText.nextSibling);
  }

  // 5. Watermarks
  function watermark(holder, alias) {
    if (!holder) return;
    let mark = [...holder.children].find((child) => child.classList?.contains('rv-wm'));
    if (!alias) { mark?.remove(); return; }
    if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
    if (!mark) {
      mark = document.createElement('div');
      mark.className = 'rv-wm';
      mark.setAttribute('aria-hidden', 'true');
      holder.appendChild(mark);
    }
    const text = `With @${alias}`;
    if (mark.textContent !== text) mark.textContent = text;
    mark.classList.toggle('rv-wm-sm', holder.getBoundingClientRect().width < 170);
  }

  function watermarkCard(card, uid) {
    const alias = aliases.get(uid) || '';
    const header = card.firstElementChild;
    watermark(header, alias);
    // Gallery photos: every other image in the card, except the small round icon.
    card.querySelectorAll('img').forEach((img) => {
      if (header && header.contains(img)) { if (img.currentSrc || img.src) imageAlias.set(img.currentSrc || img.src, alias); return; }
      if (img.getBoundingClientRect().width < 40) return;
      imageAlias.set(img.currentSrc || img.src, alias);
      watermark(img.parentElement, alias);
    });
  }

  // Enlarged photo viewers sit outside the card; match them by image address.
  function watermarkViewers() {
    document.querySelectorAll('img').forEach((img) => {
      if (img.closest('article[id^="post-"]')) return;
      const alias = imageAlias.get(img.currentSrc || img.src);
      if (alias !== undefined && img.getBoundingClientRect().width >= 120) watermark(img.parentElement, alias);
    });
  }

  // Contact a follower (2026-10-01): the post creator enters the email they
  // published with; Revlo emails them a link to confirm, then sends the message.
  function openContactFollower(uid, alias) {
    const back = document.createElement('div');
    back.className = 'rv-cf-back';
    back.innerHTML = `<div class="rv-cf" role="dialog" aria-modal="true" aria-labelledby="rv-cf-title">
      <h2 id="rv-cf-title"></h2>
      <p>Only the person who created this post can message its followers. Enter the email you published with; we will email you a link to confirm, then deliver your message with your email so they can reply.</p>
      <input type="email" placeholder="Email you used to create this post" autocomplete="email">
      <textarea rows="4" maxlength="2000" placeholder="Your message"></textarea>
      <label class="rv-robot"><input type="checkbox" style="width:18px;height:18px;margin:0"><span>I'm not a robot</span></label>
      <div class="rv-cf-actions"><button type="button" class="rv-cancel">Cancel</button><button type="button" class="rv-send" disabled>Verify email to send</button></div>
      <div class="rv-cf-msg" role="status"></div></div>`;
    back.querySelector('#rv-cf-title').textContent = `Message ${alias}`;
    const [email, text] = [back.querySelector('input[type="email"]'), back.querySelector('textarea')];
    const robot = back.querySelector('.rv-robot input');
    const send = back.querySelector('.rv-send');
    const msg = back.querySelector('.rv-cf-msg');
    const sync = () => { send.disabled = !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) && text.value.trim().length >= 2 && robot.checked); };
    [email, text].forEach((el) => el.addEventListener('input', sync));
    robot.addEventListener('change', sync);
    const close = () => back.remove();
    back.addEventListener('click', (event) => { if (event.target === back) close(); });
    back.querySelector('.rv-cancel').addEventListener('click', close);
    send.addEventListener('click', async () => {
      send.disabled = true; msg.style.color = '#333'; msg.textContent = 'Sending…';
      try {
        const res = await window.fetch('/api/contact-follower', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, follower_alias: alias, from_email: email.value.trim(), message: text.value.trim() }) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not send.');
        msg.style.color = '#1b5e20';
        msg.textContent = `Check ${email.value.trim()} for a link to confirm. Your message to ${alias} is sent once you confirm.`;
      } catch (error) {
        msg.style.color = '#b42318'; msg.textContent = error.message; sync();
      }
    });
    document.body.appendChild(back);
    email.focus();
  }

  const BADGE_TAGS = { gold: 'tags_gold', silver: 'tags_silver', bronze: 'tags_bronze' };
  function tagAllowance() {
    const p = publisher() || {};
    const settings = p.settings || {};
    let promoted = false;
    try { promoted = Boolean(localStorage.getItem('revlo_promo_reference') || sessionStorage.getItem('revlo_promo_reference')); } catch {}
    const key = promoted ? 'tags_promoted' : (BADGE_TAGS[p.trustBadge] || 'tags_normal');
    const fallback = { tags_normal: 1, tags_bronze: 2, tags_silver: 3, tags_gold: 4, tags_promoted: 5 }[key];
    return Number.isFinite(settings[key]) ? settings[key] : fallback;
  }

  // Search tags in the New post form, limited by badge.
  function mountTagsField(after) {
    if (after.parentElement.querySelector('.rv-tags-field')) return;
    const limit = tagAllowance();
    const box = document.createElement('div');
    box.className = 'rv-tags-field';
    box.innerHTML = `<label>Search tags <span style="font-weight:500;color:#7b867c">(up to ${limit})</span></label>
      <div class="rv-tags-box"><input maxlength="24" placeholder="Type a tag and press Enter"></div>
      <div class="rv-hint" style="font:12px/1.45 system-ui;color:#6b756c;margin-top:5px">Tags help people find your post in search. Badges let you add more tags.</div>`;
    const wrap = box.querySelector('.rv-tags-box');
    const input = wrap.querySelector('input');
    const draw = () => {
      wrap.querySelectorAll('span').forEach((el) => el.remove());
      currentTags.forEach((tag, i) => {
        const chip = document.createElement('span');
        chip.textContent = `#${tag}`;
        const x = document.createElement('button');
        x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', `Remove ${tag}`);
        x.addEventListener('click', () => { currentTags.splice(i, 1); draw(); });
        chip.appendChild(x);
        wrap.insertBefore(chip, input);
      });
      input.disabled = currentTags.length >= limit;
      input.placeholder = input.disabled ? 'Tag limit reached' : 'Type a tag and press Enter';
    };
    const add = () => {
      const tag = input.value.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '');
      if (tag.length >= 2 && !currentTags.includes(tag) && currentTags.length < limit) currentTags.push(tag.slice(0, 24));
      input.value = ''; draw();
    };
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } });
    input.addEventListener('blur', () => { if (input.value.trim()) add(); });
    currentTags = [];
    draw();
    after.insertAdjacentElement('afterend', box);
  }

  // Reminder that contact details are not allowed in posts.
  function mountRuleNote(after) {
    if (after.parentElement.querySelector('.rv-rule-note')) return;
    const note = document.createElement('div');
    note.className = 'rv-rule-note';
    note.innerHTML = '<strong>No contact details in posts.</strong> Phone numbers, email addresses, links, WhatsApp and social media handles are not allowed. Posts that include them are removed. People reach you safely through the Contact button.';
    after.insertAdjacentElement('afterend', note);
  }

  // Suspension countdown in the Create a post / New post windows.
  function renderSuspension() {
    if (!suspendedUntil || suspendedUntil <= Date.now()) { document.querySelectorAll('.rv-suspended').forEach((el) => el.remove()); return; }
    const heading = headingIn('Create a post') || headingIn('New post');
    if (!heading) return;
    let banner = heading.parentElement.querySelector('.rv-suspended');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'rv-suspended';
      banner.setAttribute('role', 'alert');
      heading.insertAdjacentElement('afterend', banner);
    }
    const left = Math.max(0, suspendedUntil - Date.now());
    const d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24, m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
    const text = `You can post again in ${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s.`;
    if (banner.dataset.text !== text) {
      banner.dataset.text = text;
      banner.innerHTML = '<strong>This email is suspended</strong>';
      banner.append(`${text} While suspended you cannot publish, follow or contact followers.`);
    }
  }
  setInterval(renderSuspension, 1000);

  // 3. Alias field in the New post form
  function mountAliasField() {
    const heading = headingIn('New post');
    const scope = heading?.closest('[role="dialog"]') || heading?.parentElement?.parentElement;
    if (!scope || scope.querySelector('.rv-alias-field')) return;
    const section = [...scope.querySelectorAll('*')].find((el) => el.children.length <= 3 && /Where\s*&\s*what/.test(el.textContent || '') && (el.textContent || '').length < 40);
    if (!section) return;
    const current = publisher()?.alias || '';
    const box = document.createElement('div');
    box.className = 'rv-alias-field';
    box.innerHTML = `<label for="rv-alias">Your alias <span style="font-weight:500;color:#7b867c">(optional)</span></label>
      <input id="rv-alias" maxlength="${ALIAS_MAX}" autocomplete="nickname" placeholder="e.g. Billy">
      <div class="rv-hint">Shown before your city, like “Billy Lagos, Nigeria”. It stays on all your posts until you change or clear it here. Each alias belongs to one publisher, and is freed for others after 6 months without a post.</div>`;
    const input = box.querySelector('input');
    const hint = box.querySelector('.rv-hint');
    const defaultHint = hint.textContent;
    input.value = current;
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const value = input.value.trim();
      if (!value || value === current) { hint.textContent = defaultHint; hint.classList.remove('rv-bad'); return; }
      timer = setTimeout(async () => {
        try {
          const email = publisher()?.email || '';
          const data = await previousFetch(`/api/alias-available?alias=${encodeURIComponent(value)}&email=${encodeURIComponent(email)}`).then((r) => r.json());
          if (input.value.trim() !== value) return;
          hint.textContent = data.available ? `“${value}” is available.` : (data.error || 'That alias is not available.');
          hint.classList.toggle('rv-bad', !data.available);
        } catch {}
      }, 400);
    });
    section.insertAdjacentElement('afterend', box);
    mountTagsField(box);
    mountRuleNote(box.parentElement.querySelector('.rv-tags-field') || box);
  }

  function scan() {
    mountReasonField();
    mountAliasField();
    const cards = [...document.querySelectorAll('article[id^="post-"]')];
    const uids = cards.map((card) => card.id.slice(5));
    requestReasons(uids);
    cards.forEach((card) => { const uid = card.id.slice(5); renderAlias(card, uid); renderReasons(card, uid); watermarkCard(card, uid); });
    watermarkViewers();
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
