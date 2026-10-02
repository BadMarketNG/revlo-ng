(function () {
  'use strict';

  var STORAGE_KEY = 'revlo:view-session:v1';
  var SESSION_MS = 60 * 60 * 1000;
  var TOP_THRESHOLD = 12;
  var rails = new Map();
  var framePending = false;
  var session = loadSession();

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
      var value = Math.random() * 16 | 0;
      return (char === 'x' ? value : (value & 3 | 8)).toString(16);
    });
  }

  function freshSession(armed) {
    return { id: newId(), startedAt: Date.now(), counted: [], armed: armed };
  }

  function loadSession() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (parsed && typeof parsed.id === 'string' && Array.isArray(parsed.counted)
          && typeof parsed.startedAt === 'number') {
        if (Date.now() - parsed.startedAt < SESSION_MS) return parsed;
      }
    } catch (_) {}
    var created = freshSession(window.scrollY <= TOP_THRESHOLD);
    saveSession(created);
    return created;
  }

  function saveSession(value) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) {}
  }

  function rotateExpiredSession() {
    if (Date.now() - session.startedAt < SESSION_MS) return;
    session = freshSession(window.scrollY <= TOP_THRESHOLD);
    saveSession(session);
    rails.forEach(function (entry) {
      entry.counted = false;
      entry.fill.style.transform = 'scaleX(0)';
      entry.rail.setAttribute('aria-valuenow', '0');
    });
  }

  function uidFromArticle(article) {
    var id = article && article.id || '';
    return id.indexOf('post-') === 0 ? id.slice(5) : '';
  }

  function decorate(article) {
    if (article.dataset.sample === 'true') return;
    var uid = uidFromArticle(article);
    if (!uid || rails.has(uid) || article.querySelector('.revlo-view-progress')) return;

    var rail = document.createElement('div');
    rail.className = 'revlo-view-progress';
    rail.setAttribute('role', 'progressbar');
    rail.setAttribute('aria-label', 'Post view progress');
    rail.setAttribute('aria-valuemin', '0');
    rail.setAttribute('aria-valuemax', '100');
    rail.setAttribute('aria-valuenow', '0');
    var fill = document.createElement('div');
    fill.className = 'revlo-view-progress__fill';
    rail.appendChild(fill);

    var firstSection = article.firstElementChild;
    if (firstSection && firstSection.nextSibling) {
      article.insertBefore(rail, firstSection.nextSibling);
    } else {
      article.appendChild(rail);
    }

    rails.set(uid, {
      article: article,
      rail: rail,
      fill: fill,
      counted: session.counted.indexOf(uid) !== -1,
    });
  }

  function discover() {
    document.querySelectorAll('article[id^="post-"]').forEach(decorate);
    requestFrame();
  }

  function progressFor(article) {
    var rect = article.getBoundingClientRect();
    var documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    var atPageEnd = window.scrollY + window.innerHeight >= documentHeight - 2;
    if (atPageEnd && rect.top < window.innerHeight && rect.bottom > 0) return 1;
    var distance = window.innerHeight + Math.max(rect.height, 1);
    return Math.max(0, Math.min(1, (window.innerHeight - rect.top) / distance));
  }

  function updateDisplayedCount(article, views) {
    var walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (/👁\s*[\d,]+/.test(node.nodeValue || '')) {
        node.nodeValue = (node.nodeValue || '').replace(/(👁\s*)[\d,]+/, '$1' + views.toLocaleString());
        return;
      }
    }
  }

  function record(uid, entry) {
    entry.counted = true;
    if (session.counted.indexOf(uid) === -1) session.counted.push(uid);
    saveSession(session);

    fetch('/api/posts/' + encodeURIComponent(uid) + '/view', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, completed: true }),
      keepalive: true,
    }).then(function (response) {
      if (!response.ok) throw new Error('view rejected');
      return response.json();
    }).then(function (result) {
      if (typeof result.views === 'number') updateDisplayedCount(entry.article, result.views);
    }).catch(function () {
      // Permit a later retry when the network is restored. The database RPC is
      // idempotent, so a response lost after insertion still cannot double-count.
      entry.counted = false;
      session.counted = session.counted.filter(function (value) { return value !== uid; });
      saveSession(session);
    });
  }

  function update() {
    framePending = false;
    rotateExpiredSession();
    if (!session.armed && window.scrollY <= TOP_THRESHOLD) {
      session.armed = true;
      saveSession(session);
    }

    rails.forEach(function (entry, uid) {
      if (!entry.article.isConnected) {
        rails.delete(uid);
        return;
      }
      var progress = progressFor(entry.article);
      entry.fill.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
      entry.rail.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      if (session.armed && progress >= 0.999 && !entry.counted && document.visibilityState === 'visible') {
        record(uid, entry);
      }
    });
  }

  function requestFrame() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(update);
  }

  new MutationObserver(discover).observe(document.getElementById('root'), { childList: true, subtree: true });
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('resize', requestFrame, { passive: true });
  document.addEventListener('visibilitychange', requestFrame);
  discover();
}());
