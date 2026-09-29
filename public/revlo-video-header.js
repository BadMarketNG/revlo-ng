(() => {
  'use strict';
  const videos = new Map();

  function remember(post) {
    if (post?.uid && post.media_type === 'video' && post.video_url && post.header_url) {
      videos.set(post.uid, post);
    }
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      const url = typeof input === 'string' ? input : input.url;
      if (response.ok && url.startsWith('/api/posts')) {
        const body = await response.clone().json();
        if (Array.isArray(body.posts)) body.posts.forEach(remember);
        if (body.post) remember(body.post);
        queueMicrotask(decorateAll);
      }
    } catch {}
    return response;
  };

  const style = document.createElement('style');
  style.textContent = `
    .revlo-video-carousel{position:relative!important;overflow:hidden}
    .revlo-video-carousel>video,.revlo-video-carousel>.rvh-image{width:100%!important;height:clamp(210px,36vw,320px)!important;display:block;max-height:none!important;background:#000}
    .revlo-video-carousel>video{object-fit:contain}
    .revlo-video-carousel>.rvh-image{object-fit:cover}
    .revlo-video-carousel>[hidden]{display:none!important}
    .rvh-selectors{position:absolute;z-index:12;top:12px;right:12px;display:flex;gap:8px;padding:7px 9px;border-radius:999px;background:rgba(8,15,12,.56);box-shadow:0 4px 16px rgba(0,0,0,.24);backdrop-filter:blur(5px)}
    .rvh-selectors button{width:15px;height:15px;padding:0;border:2px solid #fff;border-radius:50%;background:transparent;box-shadow:0 1px 3px rgba(0,0,0,.42);cursor:pointer}
    .rvh-selectors button[aria-current="true"]{background:#fff}
    .rvh-selectors button:focus-visible{outline:3px solid #78df8b;outline-offset:3px}
    @media(max-width:520px){.revlo-video-carousel>video,.revlo-video-carousel>.rvh-image{height:220px!important}.rvh-selectors{top:9px;right:9px}}
  `;
  document.head.appendChild(style);

  function decorate(card, post) {
    if (card.dataset.revloVideoHeader === 'true') return;
    const video = card.querySelector('video');
    const header = video?.parentElement;
    if (!video || !header) return;
    card.dataset.revloVideoHeader = 'true';
    header.classList.add('revlo-video-carousel');

    const image = document.createElement('img');
    image.className = 'rvh-image';
    image.src = post.header_url;
    image.alt = `${post.title || 'Post'} header image`;
    image.hidden = true;
    video.insertAdjacentElement('afterend', image);

    const selectors = document.createElement('div');
    selectors.className = 'rvh-selectors';
    selectors.setAttribute('aria-label', 'Choose header media');
    const videoSelector = document.createElement('button');
    videoSelector.type = 'button';
    videoSelector.setAttribute('aria-label', 'Show video');
    const imageSelector = document.createElement('button');
    imageSelector.type = 'button';
    imageSelector.setAttribute('aria-label', 'Show header image');
    selectors.append(videoSelector, imageSelector);

    let current = 0;
    const show = (index) => {
      current = (index + 2) % 2;
      const showingVideo = current === 0;
      if (!showingVideo) video.pause();
      video.hidden = !showingVideo;
      image.hidden = showingVideo;
      videoSelector.setAttribute('aria-current', String(showingVideo));
      imageSelector.setAttribute('aria-current', String(!showingVideo));
    };
    videoSelector.addEventListener('click', (event) => { event.stopPropagation(); show(0); });
    imageSelector.addEventListener('click', (event) => { event.stopPropagation(); show(1); });
    header.append(selectors);
    show(0);
  }

  function decorateAll() {
    videos.forEach((post, uid) => {
      const card = document.getElementById(`post-${uid}`);
      if (card) decorate(card, post);
    });
  }

  new MutationObserver(decorateAll).observe(document.querySelector('#root') || document.body, { childList: true, subtree: true });
})();
