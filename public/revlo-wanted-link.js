(() => {
  'use strict';
  const style = document.createElement('style');
  style.textContent = '.revlo-wanted-link{display:inline-flex;align-items:center;justify-content:center;border:1.5px solid #1b5e20;border-radius:14px;padding:13px 18px;color:#1b5e20;background:#fff;text-decoration:none;font:800 16px system-ui;min-height:22px}.revlo-wanted-link:hover{background:#edf6ee}.revlo-wanted-found{border:1px solid #1b5e20;border-radius:10px;background:#fff;color:#1b5e20;padding:9px 13px;font:700 14px system-ui;cursor:pointer;margin-left:8px}.revlo-wanted-dialog{border:0;border-radius:16px;padding:24px;width:min(410px,calc(100vw - 48px));box-shadow:0 15px 50px #0005;font:15px system-ui}.revlo-wanted-dialog::backdrop{background:#0008}.revlo-wanted-dialog h2{margin:0 0 8px}.revlo-wanted-dialog p{line-height:1.45}.revlo-wanted-dialog input{box-sizing:border-box;width:100%;padding:10px;border:1px solid #aab9aa;border-radius:8px;font:16px system-ui}.revlo-wanted-dialog button{border:0;border-radius:8px;background:#1b5e20;color:#fff;padding:10px 14px;font:700 14px system-ui;cursor:pointer;margin:12px 8px 0 0}.revlo-wanted-dialog button.cancel{background:#edf1ec;color:#24422d}';
  document.head.appendChild(style);
  function foundDialog(uid) {
    const dialog = document.createElement('dialog');
    dialog.className = 'revlo-wanted-dialog';
    const heading = document.createElement('h2'); heading.textContent = 'Found what you needed?';
    const note = document.createElement('p'); note.textContent = 'Enter the email you used to post. We will send a private link to close this request.';
    const form = document.createElement('form');
    const input = document.createElement('input'); input.type = 'email'; input.required = true; input.placeholder = 'Your posting email'; input.setAttribute('aria-label', 'Your posting email');
    const submit = document.createElement('button'); submit.textContent = 'Email me the link';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'cancel'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => dialog.close());
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    form.append(input, submit, cancel, status);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); submit.disabled = true; status.textContent = 'Sending…';
      try {
        const response = await fetch('/api/outcomes/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, email: input.value.trim() }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not send the link.');
        status.textContent = data.message || 'Check your email for the link.';
      } catch (error) { status.textContent = error.message; submit.disabled = false; }
    });
    dialog.append(heading, note, form); document.body.appendChild(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal(); input.focus();
  }
  function mount() {
    const button = [...document.querySelectorAll('button')].find((item) => /Post something — it.s free/.test(item.textContent || '') && !item.closest('article'));
    if (button && !button.parentElement?.querySelector('.revlo-wanted-link')) {
      const link = document.createElement('a');
      link.href = '/wanted';
      link.className = 'revlo-wanted-link';
      link.textContent = 'Post what you need';
      button.insertAdjacentElement('afterend', link);
    }
    document.querySelectorAll('article[data-post-type="wanted"]:not([data-sample])').forEach((article) => {
      if (article.querySelector('.revlo-wanted-found')) return;
      const contact = [...article.querySelectorAll('button')].find((item) => /Contact/.test(item.textContent || ''));
      if (!contact) return;
      const found = document.createElement('button');
      found.type = 'button'; found.className = 'revlo-wanted-found'; found.textContent = '✓ Found it?';
      found.addEventListener('click', () => foundDialog(article.id.slice(5)));
      contact.insertAdjacentElement('afterend', found);
    });
  }
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; mount(); }); })
    .observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
  mount();
})();
