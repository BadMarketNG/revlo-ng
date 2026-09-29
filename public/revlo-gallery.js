(() => {
  'use strict';
  // Up to five extra photos per post, as on BadMarket. The app already shows
  // a post's gallery (thumbnail strip, full-screen viewer, hover expansion);
  // this adds them to the post form and uploads them when the post is published.
  const MAX_PHOTOS = 5;
  let photos = [];

  function shrink(file, max = 1600) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        let quality = 0.85;
        let data = canvas.toDataURL('image/jpeg', quality);
        while (data.length * 0.75 > 1.2e6 && quality > 0.45) { quality -= 0.1; data = canvas.toDataURL('image/jpeg', quality); }
        resolve(data);
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This photo could not be opened.')); };
      image.src = url;
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .revlo-gallery-field{margin:18px 0;padding:14px 16px;border:1px solid #e5e8e3;border-radius:16px;background:#fff;font:14px system-ui;color:#233128}
    .revlo-gallery-field .rg-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:10px}
    .revlo-gallery-field .rg-head strong{font-size:15px}
    .revlo-gallery-field .rg-head span{font-size:12px;color:#687068}
    .revlo-gallery-field .rg-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
    .revlo-gallery-field .rg-item,.revlo-gallery-field .rg-add{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden}
    .revlo-gallery-field .rg-item img{width:100%;height:100%;object-fit:cover;display:block}
    .revlo-gallery-field .rg-item button{position:absolute;top:4px;right:4px;width:22px;height:22px;border:0;border-radius:50%;background:rgba(0,0,0,.65);color:#fff;font-size:13px;line-height:1;cursor:pointer}
    .revlo-gallery-field .rg-add{border:1.5px dashed #b9c7ba;background:#f7faf6;color:#1b5e20;font-weight:800;font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
    .revlo-gallery-field .rg-add span{font-size:22px;line-height:1}
    .revlo-gallery-field .rg-error{margin:8px 0 0;color:#c62828;font-size:12px}
    @media(max-width:420px){.revlo-gallery-field .rg-grid{grid-template-columns:repeat(3,1fr)}}
  `;
  document.head.appendChild(style);

  function render(field) {
    const grid = field.querySelector('.rg-grid');
    grid.textContent = '';
    photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = 'rg-item';
      const img = document.createElement('img');
      img.src = photo;
      img.alt = `Photo ${index + 1}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove photo ${index + 1}`);
      remove.onclick = () => { photos.splice(index, 1); render(field); };
      item.append(img, remove);
      grid.appendChild(item);
    });
    if (photos.length < MAX_PHOTOS) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'rg-add';
      add.innerHTML = '<span>＋</span>Add photos';
      add.onclick = () => field.querySelector('input[type=file]').click();
      grid.appendChild(add);
    }
    field.querySelector('.rg-count').textContent = `${photos.length}/${MAX_PHOTOS}`;
  }

  function mount(modal) {
    if (modal.querySelector('.revlo-gallery-field')) return;
    const publish = [...modal.querySelectorAll('button')].find((b) => /publish/i.test(b.textContent));
    if (!publish) return;
    const footer = publish.parentElement;
    const anchor = modal.querySelector('.revlo-feature-panel') || (getComputedStyle(footer).position === 'sticky' ? footer : publish);
    const field = document.createElement('section');
    field.className = 'revlo-gallery-field';
    field.innerHTML = '<div class="rg-head"><strong>Photos</strong><span>Up to 5 · <b class="rg-count">0/5</b></span></div><div class="rg-grid"></div><input type="file" accept="image/*" multiple hidden><p class="rg-error" role="alert" hidden></p>';
    const input = field.querySelector('input');
    const error = field.querySelector('.rg-error');
    input.addEventListener('change', async () => {
      const picked = [...(input.files || [])];
      const files = picked.slice(0, MAX_PHOTOS - photos.length);
      input.value = '';
      error.hidden = true;
      for (const file of files) {
        try { photos.push(await shrink(file)); } catch (cause) { error.textContent = cause.message; error.hidden = false; }
      }
      if (picked.length > files.length) { error.textContent = `You can add up to ${MAX_PHOTOS} photos, so only the first ${files.length} were added.`; error.hidden = false; }
      render(field);
    });
    anchor.parentElement.insertBefore(field, anchor);
    render(field);
  }

  // Upload the photos when the post is published and attach them as its gallery.
  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === '/api/posts' && init.method === 'POST' && photos.length) {
      try {
        const body = JSON.parse(init.body);
        const gallery = [];
        for (const [index, photo] of photos.entries()) {
          const form = new FormData();
          form.append('file', await (await previousFetch(photo)).blob(), `photo-${index + 1}.jpg`);
          const response = await previousFetch('/api/upload', { method: 'POST', body: form });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.url) {
            return new Response(JSON.stringify({ error: result.error || `Photo ${index + 1} could not be uploaded. Try again.` }), { status: response.status || 400, headers: { 'Content-Type': 'application/json' } });
          }
          gallery.push(result.url);
        }
        body.gallery = gallery;
        init = { ...init, body: JSON.stringify(body) };
      } catch {}
      const response = await previousFetch(input, init);
      if (response.ok) photos = [];
      return response;
    }
    return previousFetch(input, init);
  };

  new MutationObserver(() => {
    const heading = [...document.querySelectorAll('h1,h2,h3')].find((h) => h.textContent.trim() === 'New post');
    if (heading) mount(heading.closest('[role="dialog"]') || heading.parentElement?.parentElement || document.body);
    else if (photos.length && !document.querySelector('.revlo-gallery-field')) photos = [];
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
