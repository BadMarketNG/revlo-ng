(() => {
  'use strict';
  // Report a scam contact (2026-10-03). Additive: a "🚩 Report a scam contact" link in the footer opens a
  // short form for anyone contacted fraudulently (through a Revlo post, by email, phone, WhatsApp…).
  // The reporter confirms their email; our team reviews; confirmed reports block the reported email on
  // Revlo and count in "Check an email or number". Also opens from revlo.ng/app.html?scam=report.

  const METHODS = ['Through a Revlo post', 'Email', 'Phone call', 'SMS', 'WhatsApp', 'Telegram', 'Social media', 'Other'];
  const TYPES = ['Fake job offer', 'Fake landlord or agent', 'Fake buyer or seller', 'Asked for money upfront', 'Pretending to be a company or official', 'Phishing link or code request', 'Other'];

  const style = document.createElement('style');
  style.textContent = `
    .rv-sc-dialog{position:fixed;inset:0;z-index:2147480001;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}
    @media (min-width:640px){.rv-sc-dialog{align-items:center}}
    .rv-sc-sheet{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fffdf7;border-radius:20px 20px 0 0;padding:20px 18px 22px;box-sizing:border-box;box-shadow:0 -10px 40px rgba(0,0,0,.25)}
    @media (min-width:640px){.rv-sc-sheet{border-radius:20px}}
    .rv-sc-sheet h3{margin:0 0 4px;font:900 22px/1.2 Georgia,serif;color:#1b5e20}
    .rv-sc-sub{margin:0 0 12px;font:14px/1.5 system-ui;color:#555}
    .rv-sc-close{float:right;border:0;background:#eee;border-radius:999px;width:34px;height:34px;font-size:18px;cursor:pointer}
    .rv-sc-box{border:1.5px solid #e3e3e3;border-radius:14px;padding:12px;background:#fff;margin:0 0 14px}
    .rv-sc-box h4{margin:0 0 8px;font:800 14px system-ui;color:#1a1a1a}
    .rv-sc-row{display:flex;gap:8px;flex-wrap:wrap}
    .rv-sc-sheet form{display:grid;gap:10px}
    .rv-sc-sheet label{display:grid;gap:4px;font:700 12.5px system-ui;color:#333}
    .rv-sc-sheet input,.rv-sc-sheet select,.rv-sc-sheet textarea{font:15px system-ui;padding:10px 11px;border:1.5px solid #d6d6d6;border-radius:10px;background:#fff;color:#1a1a1a;width:100%;box-sizing:border-box}
    .rv-sc-sheet textarea{min-height:100px;resize:vertical}
    .rv-sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    @media (max-width:480px){.rv-sc-grid{grid-template-columns:1fr}}
    .rv-sc-robot{display:flex!important;align-items:center;gap:8px!important}
    .rv-sc-robot input{width:auto}
    .rv-sc-go{border:0;border-radius:12px;background:#b42318;color:#fff;font:800 15px system-ui;padding:12px 16px;cursor:pointer}
    .rv-sc-go:disabled{opacity:.6}
    .rv-sc-check{border:0;border-radius:10px;background:#1b5e20;color:#fff;font:800 14px system-ui;padding:10px 14px;cursor:pointer;white-space:nowrap}
    .rv-sc-msg{margin:4px 0 0;font:700 14px/1.4 system-ui;color:#1b5e20}.rv-sc-msg.err{color:#b42318}
    .rv-sc-fine{font:12px/1.45 system-ui;color:#888;margin:0}
    .rv-sc-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147480002;background:#1b5e20;color:#fff;border-radius:12px;padding:12px 16px;font:700 14px system-ui;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:calc(100vw - 32px)}
  `;
  document.head.appendChild(style);

  const el = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text != null) e.textContent = text; return e; };
  const option = (select, values) => values.forEach((v) => select.add(new Option(v, v)));

  function open() {
    if (document.querySelector('.rv-sc-dialog')) return;
    const dialog = el('div', 'rv-sc-dialog');
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'rv-sc-title');
    const sheet = el('div', 'rv-sc-sheet');
    const close = el('button', 'rv-sc-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close');
    sheet.append(close, el('h3', '', '🚩 Report a scam contact'));
    sheet.lastChild.id = 'rv-sc-title';
    sheet.appendChild(el('p', 'rv-sc-sub', 'Someone contacted you fraudulently through Revlo, or by email, phone or WhatsApp? Report them so we can block them and warn others.'));

    // Check first.
    const check = el('div', 'rv-sc-box');
    check.innerHTML = '<h4>Check an email or number</h4><div class="rv-sc-row"><input aria-label="Email or phone number" placeholder="name@example.com or +234 803 123 4567" style="flex:1;min-width:180px"><button type="button" class="rv-sc-check">Check</button></div><p class="rv-sc-msg" role="status" aria-live="polite"></p>';
    const checkInput = check.querySelector('input'); const checkMsg = check.querySelector('.rv-sc-msg');
    check.querySelector('button').addEventListener('click', async () => {
      checkMsg.className = 'rv-sc-msg'; checkMsg.textContent = 'Checking…';
      try {
        const r = await fetch(`/api/scam-reports/check?q=${encodeURIComponent(checkInput.value)}`);
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Check failed.');
        if (body.count) { checkMsg.classList.add('err'); checkMsg.textContent = `⚠️ Confirmed as a scam contact ${body.count} time${body.count === 1 ? '' : 's'}. Do not send money or codes.`; }
        else checkMsg.textContent = 'No confirmed reports yet. That does not mean it is safe; take care.';
      } catch (error) { checkMsg.classList.add('err'); checkMsg.textContent = error.message; }
    });
    sheet.appendChild(check);

    const form = el('form'); form.noValidate = true;
    form.innerHTML = `
      <div class="rv-sc-grid">
        <label>How did they contact you?<select name="contact_method"></select></label>
        <label>What happened?<select name="scam_type"></select></label>
      </div>
      <div class="rv-sc-grid">
        <label>Their email address<input name="subject_email" type="email" placeholder="name@example.com"></label>
        <label>Their phone number<input name="subject_phone" type="tel" placeholder="With country code, e.g. +234…"></label>
      </div>
      <div class="rv-sc-grid">
        <label>Their WhatsApp / social account<input name="subject_handle" placeholder="@handle or profile link"></label>
        <label>Revlo post ID (if any)<input name="post_uid" placeholder="e.g. RV-AB12CD"></label>
      </div>
      <label>Tell us what happened<textarea name="details" maxlength="1500" placeholder="What they said, what they asked for and what happened next. Do not include your own passwords, card numbers or codes."></textarea></label>
      <div class="rv-sc-grid">
        <label>Money lost (optional)<input name="money_lost" inputmode="decimal" placeholder="0"></label>
        <label>Currency<input name="currency" maxlength="3" placeholder="NGN"></label>
      </div>
      <label>Screenshots (up to 2, 500 KB each)<input name="evidence" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
      <label>Your email (to confirm the report; never shown)<input name="reporter_email" type="email" autocomplete="email" required></label>
      <label class="rv-sc-robot"><input type="checkbox" required> I'm not a robot</label>
      <button class="rv-sc-go" type="submit">Send report</button>
      <p class="rv-sc-msg" role="status" aria-live="polite"></p>
      <p class="rv-sc-fine">Only report what happened to you. Our team reviews every report before it counts. False reports may be blocked.</p>`;
    option(form.contact_method, METHODS); option(form.scam_type, TYPES);
    const fromPost = location.search.match(/[?&]scam_post=([A-Z0-9-]+)/i);
    if (fromPost) form.post_uid.value = fromPost[1];
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const msg = form.querySelector('.rv-sc-msg'); const go = form.querySelector('.rv-sc-go'); msg.className = 'rv-sc-msg';
      const files = [...form.evidence.files];
      if (files.length > 2) { msg.classList.add('err'); msg.textContent = 'Add no more than two screenshots.'; return; }
      if (files.some((f) => f.size > 500 * 1024)) { msg.classList.add('err'); msg.textContent = 'Each screenshot must be 500 KB or smaller.'; return; }
      go.disabled = true; msg.textContent = 'Sending…';
      try {
        const data = new FormData(form);
        data.delete('evidence'); files.forEach((f) => data.append('evidence', f));
        const r = await fetch('/api/scam-reports', { method: 'POST', body: data });
        const body = await r.json().catch(() => ({}));
        if (r.status === 403 && body.turnstile) throw new Error('Please complete the security check above, then send again.');
        if (!r.ok) throw new Error(body.error || 'Could not send the report. Please try again.');
        const address = form.reporter_email.value.trim();
        form.querySelectorAll('label, .rv-sc-grid, .rv-sc-go, .rv-sc-fine').forEach((x) => x.remove());
        msg.textContent = `Almost done: check ${address} and tap the link to confirm your report.`;
      } catch (error) { msg.classList.add('err'); msg.textContent = error.message; go.disabled = false; }
    });
    sheet.appendChild(form);
    dialog.appendChild(sheet); document.body.appendChild(dialog);
    const shut = () => { dialog.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') shut(); };
    close.addEventListener('click', shut); dialog.addEventListener('click', (e) => { if (e.target === dialog) shut(); }); document.addEventListener('keydown', onKey);
    form.contact_method.focus();
  }

  function addFooterLink() {
    const nav = document.querySelector('.revlo-site-footer nav');
    if (!nav || nav.querySelector('.rv-sc-link')) return;
    const link = el('a', 'rv-sc-link', '🚩 Report a scam contact');
    link.href = '/app.html?scam=report';
    link.addEventListener('click', (e) => { e.preventDefault(); open(); });
    nav.appendChild(link);
  }

  function toast(text) { const t = el('div', 'rv-sc-toast', text); t.setAttribute('role', 'status'); document.body.appendChild(t); setTimeout(() => t.remove(), 7000); }

  const state = new URLSearchParams(location.search).get('scam');
  if (state) {
    if (state === 'report') setTimeout(open, 1200);
    const text = { sent: '🚩 Thanks. Your report is with our team for review.', done: 'This report was already confirmed.', invalid: 'That report link is not valid or has expired.' }[state];
    if (text) setTimeout(() => toast(text), 1200);
    const url = new URL(location.href); url.searchParams.delete('scam'); history.replaceState(null, '', url);
  }
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; addFooterLink(); }, 200); })
    .observe(document.documentElement, { childList: true, subtree: true });
  addFooterLink();
})();
