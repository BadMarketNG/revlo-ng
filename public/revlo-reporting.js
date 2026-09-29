(() => {
  'use strict';
  const reasons = [
    ['spam', 'Spam'], ['false_info', 'False information'], ['offensive', 'Offensive content'],
    ['copyright', 'Copyright'], ['other', 'Other'],
  ];
  const buttonStyle = 'width:100%;border:0;border-radius:12px;background:#D32F2F;color:#fff;padding:13px 16px;font:800 15px system-ui;cursor:pointer';

  function reasonOptions(disabled) {
    return reasons.map(([value, label]) => `<label class="rv-report-reason${disabled ? ' rv-locked' : ''}"><input type="radio" name="reason" value="${value}" ${disabled ? 'disabled' : ''}><span>${label}</span></label>`).join('');
  }

  function renderLocked(slot) {
    if (slot.dataset.reportReady === 'true') return;
    slot.dataset.reportReady = 'true';
    slot.innerHTML = `<div class="rv-report-email"><p>Enter your email first. We will send a one-time verification link before you can submit a report.</p><input type="email" autocomplete="email" placeholder="Your email address"><button type="button">Verify email to report</button><p class="rv-report-status" role="status"></p></div><fieldset disabled><legend>What are you reporting?</legend>${reasonOptions(true)}<label class="rv-report-upload">Optional evidence (up to 2 images)<input type="file" disabled></label><button type="button" disabled style="${buttonStyle};opacity:.45">Submit report</button></fieldset>`;
    const email = slot.querySelector('input[type=email]');
    const send = slot.querySelector('.rv-report-email button');
    const status = slot.querySelector('.rv-report-status');
    send.addEventListener('click', async () => {
      if (!email.value.includes('@') || send.disabled) { status.textContent = 'Enter a valid email address.'; return; }
      send.disabled = true; status.textContent = 'Sending verification link…';
      try {
        const response = await fetch('/api/report', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'request_verification', uid: slot.dataset.uid, email: email.value }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Could not send verification email.');
        status.textContent = 'Check your email and open the verification link. This report will continue in this tab.';
        email.disabled = true; send.textContent = 'Verification email sent';
      } catch (error) { status.textContent = error.message; send.disabled = false; }
    });
  }

  function modalShell() {
    const overlay = document.createElement('div');
    overlay.className = 'rv-report-overlay';
    overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="rv-report-title"><button type="button" class="rv-report-close" aria-label="Close">×</button><h1 id="rv-report-title">Report this post</h1><p class="rv-report-post"></p><p class="rv-report-verified"></p><form><fieldset><legend>What are you reporting?</legend>${reasonOptions(false)}</fieldset><label class="rv-report-detail">Additional details <span>(optional)</span><textarea name="details" maxlength="1000" rows="4" placeholder="Tell the moderators what they should review"></textarea></label><label class="rv-report-upload">Evidence <span>(optional, up to 2 images)</span><input type="file" name="evidence" accept="image/jpeg,image/png,image/webp" multiple><small>JPEG, PNG or WebP. Maximum 500 KB each.</small></label><p class="rv-report-files"></p><p class="rv-report-error" role="alert"></p><button type="submit" style="${buttonStyle}">Submit report</button></form></section>`;
    overlay.querySelector('.rv-report-close').onclick = () => overlay.remove();
    overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    return overlay;
  }

  async function continueVerified(token) {
    const response = await fetch(`/api/report?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    const overlay = modalShell();
    if (!response.ok || !data.valid) {
      overlay.querySelector('form').remove();
      overlay.querySelector('.rv-report-post').textContent = data.error || 'This report link is invalid or has expired.';
      overlay.querySelector('.rv-report-verified').textContent = 'Close this window and request a new verification link.';
      sessionStorage.removeItem('revlo_report_token');
      return;
    }
    overlay.querySelector('.rv-report-post').textContent = `Post: “${data.title}” (${data.uid})`;
    overlay.querySelector('.rv-report-verified').textContent = `✓ Email verified: ${data.email}`;
    const form = overlay.querySelector('form');
    const fileInput = form.querySelector('input[type=file]');
    const fileText = form.querySelector('.rv-report-files');
    fileInput.addEventListener('change', () => {
      const files = [...fileInput.files];
      if (files.length > 2) fileInput.value = '';
      fileText.textContent = files.length > 2 ? 'Choose no more than two images.' : files.map((file) => file.name).join(' · ');
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type=submit]');
      const error = form.querySelector('.rv-report-error');
      const reason = form.querySelector('input[name=reason]:checked');
      if (!reason) { error.textContent = 'Choose what you are reporting.'; return; }
      const files = [...fileInput.files];
      if (files.length > 2 || files.some((file) => file.size > 500 * 1024)) { error.textContent = 'Choose up to two images, no larger than 500 KB each.'; return; }
      submit.disabled = true; submit.textContent = 'Submitting…'; error.textContent = '';
      const body = new FormData(form); body.set('token', token); body.set('reason', reason.value);
      try {
        const result = await fetch('/api/report', { method: 'POST', body });
        const payload = await result.json().catch(() => ({}));
        if (!result.ok) throw new Error(payload.error || 'Could not submit report.');
        sessionStorage.removeItem('revlo_report_token');
        form.innerHTML = '<div style="text-align:center;padding:20px 0"><div style="font-size:42px">✓</div><h2>Report submitted</h2><p>Revlo moderators can now review your report and any evidence you supplied.</p></div>';
      } catch (failure) { error.textContent = failure.message; submit.disabled = false; submit.textContent = 'Submit report'; }
    });
  }

  const style = document.createElement('style');
  style.textContent = `.revlo-report-slot{font:14px system-ui;color:#3f4b43}.rv-report-email input,.rv-report-detail textarea{box-sizing:border-box;width:100%;border:1.5px solid #d7dcd8;border-radius:12px;padding:12px;font:15px system-ui}.rv-report-email button{${buttonStyle};margin-top:10px}.rv-report-status{min-height:20px;color:#5f6b63;line-height:1.45}.revlo-report-slot fieldset,.rv-report-overlay fieldset{border:0;padding:0;margin:18px 0}.revlo-report-slot legend,.rv-report-overlay legend{font-weight:800;margin-bottom:8px}.rv-report-reason{display:flex;gap:10px;align-items:center;border:1.5px solid #d7dcd8;border-radius:12px;padding:11px 13px;margin:8px 0;cursor:pointer}.rv-report-reason.rv-locked{opacity:.5;cursor:not-allowed}.rv-report-upload,.rv-report-detail{display:grid;gap:7px;margin:14px 0;font-weight:750}.rv-report-upload span,.rv-report-detail span,.rv-report-upload small{font-weight:400;color:#6a756d}.rv-report-overlay{position:fixed;inset:0;z-index:25000;background:#0008;display:grid;place-items:center;padding:18px;overflow:auto}.rv-report-overlay section{position:relative;width:min(560px,100%);max-height:calc(100vh - 36px);overflow:auto;box-sizing:border-box;background:#fff;border-radius:22px;padding:28px;box-shadow:0 24px 80px #0005;font:15px system-ui;color:#17241b}.rv-report-overlay h1{margin:0 42px 10px 0}.rv-report-close{position:absolute;right:18px;top:16px;width:40px;height:40px;border:0;border-radius:50%;background:#f0f1f0;font-size:28px;cursor:pointer}.rv-report-verified{color:#1B5E20;font-weight:750}.rv-report-error{color:#c62828;min-height:20px}.rv-report-files{color:#5f6b63;font-size:13px}@media(max-width:600px){.rv-report-overlay{padding:0;align-items:end}.rv-report-overlay section{border-radius:22px 22px 0 0;max-height:94vh;padding:22px}}`;
  document.head.appendChild(style);

  const params = new URLSearchParams(location.search);
  const queryToken = params.get('report_token');
  if (queryToken) {
    sessionStorage.setItem('revlo_report_token', queryToken);
    params.delete('report_token');
    history.replaceState(null, '', `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`);
  }
  const token = queryToken || sessionStorage.getItem('revlo_report_token');
  if (token) setTimeout(() => continueVerified(token), 50);

  const scan = () => document.querySelectorAll('.revlo-report-slot').forEach(renderLocked);
  scan();
  new MutationObserver(scan).observe(document.querySelector('#root') || document.body, { childList: true, subtree: true });
})();
