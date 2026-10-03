(() => {
  'use strict';
  const state = { age: '', intent: '', adult: false, self: false, photo: false };
  const css = document.createElement('style');
  css.textContent = `
    .rv-dating-profile{margin:10px 0 4px;padding:16px;border:1.5px solid #c8d8c9;border-radius:14px;background:#f6faf6;font:14px/1.45 system-ui;color:#24362a}
    .rv-dating-profile[hidden]{display:none}
    .rv-dating-profile h4{margin:0 0 4px;font:800 17px system-ui;color:#1b5e20}
    .rv-dating-profile p{margin:0 0 12px;color:#526058}
    .rv-dating-profile .rv-dating-fields{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px;margin-bottom:12px}
    .rv-dating-profile label{display:grid;gap:4px;font-weight:700}
    .rv-dating-profile input[type=number],.rv-dating-profile select{width:100%;box-sizing:border-box;border:1.5px solid #c9d4c9;border-radius:9px;background:#fff;padding:10px;font:15px system-ui;color:#14271b}
    .rv-dating-profile .rv-dating-check{display:flex;align-items:flex-start;gap:8px;margin:8px 0;font-weight:500}
    .rv-dating-profile .rv-dating-check input{margin-top:3px;flex:none}
    @media(max-width:520px){.rv-dating-profile .rv-dating-fields{grid-template-columns:1fr}}
  `;
  document.head.append(css);

  function categoryNow() {
    return [...document.querySelectorAll('select')].find(s => s.dataset.revloCategorySelect === 'true')?.value || '';
  }

  function checkbox(text, key) {
    const label = document.createElement('label');
    label.className = 'rv-dating-check';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = state[key];
    input.addEventListener('change', () => { state[key] = input.checked; });
    label.append(input, document.createTextNode(text));
    return label;
  }

  function mount(details) {
    const panel = document.createElement('section');
    panel.className = 'rv-dating-profile';
    const heading = document.createElement('h4');
    heading.textContent = 'Your Dating profile';
    const hint = document.createElement('p');
    hint.textContent = 'Put your first name or nickname in Headline, and introduce yourself in Details. Use your city, not your address. Upload a current photo of yourself as the header image. Replies go through Revlo Contact; your posting email is not shown on the profile.';
    const fields = document.createElement('div');
    fields.className = 'rv-dating-fields';
    const ageLabel = document.createElement('label');
    ageLabel.textContent = 'Age';
    const age = document.createElement('input');
    age.type = 'number'; age.min = '18'; age.max = '99'; age.inputMode = 'numeric'; age.value = state.age;
    age.addEventListener('input', () => { state.age = age.value; });
    ageLabel.append(age);
    const intentLabel = document.createElement('label');
    intentLabel.textContent = 'Looking for';
    const intent = document.createElement('select');
    [['', 'Choose…'], ['dating', 'Dating'], ['relationship', 'A relationship'], ['marriage', 'Marriage']].forEach(([value, text]) => intent.add(new Option(text, value)));
    intent.value = state.intent;
    intent.addEventListener('change', () => { state.intent = intent.value; });
    intentLabel.append(intent);
    fields.append(ageLabel, intentLabel);
    panel.append(heading, hint, fields,
      checkbox('I am 18 or older.', 'adult'),
      checkbox('This is my own profile, and I want it shown publicly on Revlo.', 'self'),
      checkbox('The profile photo shows me and is not stock, AI-generated or someone else’s.', 'photo'));
    details.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function sync() {
    const details = document.querySelector('textarea[aria-label="Details"]');
    if (!details) return;
    const panel = document.querySelector('.rv-dating-profile') || mount(details);
    const dating = categoryNow() === 'dating';
    panel.hidden = !dating;
    const duration = document.querySelector('[role="radiogroup"][aria-label="Duration"]');
    if (duration) {
      duration.style.display = dating ? 'none' : '';
      const note = duration.nextElementSibling;
      if (note?.classList.contains('revlo-badge-length-note')) note.style.display = dating ? 'none' : '';
      let datingNote = document.querySelector('.rv-dating-duration');
      if (!datingNote) {
        datingNote = document.createElement('p');
        datingNote.className = 'rv-dating-duration';
        datingNote.textContent = 'Your profile stays up for 7 days. You can remove it sooner using the link emailed to you.';
        duration.insertAdjacentElement('afterend', datingNote);
      }
      datingNote.hidden = !dating;
      const liveUntil = duration.previousElementSibling?.lastElementChild;
      if (liveUntil) liveUntil.style.display = dating ? 'none' : '';
    }
    const preview = document.querySelector('[aria-label="Add thumbnail"]')?.nextElementSibling?.lastElementChild;
    if (preview && / · (?:24 hours|18 hours|72 hours|1 week|2½ weeks|7 days)$/.test(preview.textContent || '')) {
      const next = (preview.textContent || '').replace(/ · (?:24 hours|18 hours|72 hours|1 week|2½ weeks|7 days)$/, dating ? ' · 7 days' : ' · 24 hours');
      if (preview.textContent !== next) preview.textContent = next;
    }
  }

  const previousFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    let dating = false;
    try {
      const url = typeof input === 'string' ? input : input?.url;
      if (url && /\/api\/posts$/.test(url.split('?')[0]) && init?.method === 'POST' && typeof init.body === 'string') {
        const body = JSON.parse(init.body);
        if (body.category === 'dating') {
          dating = true;
          body.dating_profile = {
            age: state.age, intent: state.intent, confirmed_adult: state.adult,
            confirmed_self: state.self, confirmed_photo: state.photo,
          };
          init = { ...init, body: JSON.stringify(body) };
        }
      }
    } catch { /* Server validation still applies. */ }
    return previousFetch(input, init).then(response => {
      if (dating && response.ok) Object.assign(state, { age: '', intent: '', adult: false, self: false, photo: false });
      return response;
    });
  };
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; setTimeout(() => { queued = false; sync(); }, 80); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('change', e => { if (e.target instanceof HTMLSelectElement) sync(); });
})();
