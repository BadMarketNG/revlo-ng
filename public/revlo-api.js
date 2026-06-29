// Revlo.ng front-end API client.
// Include this in the front end (or copy these functions into the bundle) to
// talk to the backend. All calls are relative, so they work in dev and prod.

const RevloAPI = {
  async listPosts(duration = 'now') {
    const r = await fetch(`/api/posts?duration=${encodeURIComponent(duration)}`);
    if (!r.ok) throw new Error('failed to load posts');
    return (await r.json()).posts;
  },

  async getPost(uid) {
    const r = await fetch(`/api/posts/${encodeURIComponent(uid)}`);
    if (!r.ok) return null;
    return (await r.json()).post;
  },

  async createPost(post) {
    const r = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(post),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'failed to create');
    return data.post;
  },

  async uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'upload failed');
    return data.url;
  },

  async contact(uid, from_email, message) {
    const r = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, from_email, message }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'failed');
    return data;
  },

  async follow(uid, follower_email) {
    const r = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, follower_email }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'failed');
    return data;
  },

  async report(uid, reason) {
    const r = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, reason }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'failed');
    return data;
  },

  async requestDelete(uid, email) {
    const r = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, email }),
    });
    return await r.json();
  },

  async bmLink(uid, payout_email) {
    const r = await fetch('/api/bm-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, payout_email }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'failed');
    return data;
  },

  async sendMagicLink(email) {
    const r = await fetch('/api/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'failed');
    return data;
  },
};

if (typeof window !== 'undefined') window.RevloAPI = RevloAPI;
export default RevloAPI;
