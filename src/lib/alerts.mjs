// Alert me (2026-10-02): validation and matching for daily post alerts.

export const ALERT_CATEGORIES = { all: 'All posts', jobs: 'Jobs', rentals: 'Rentals', for_sale: 'For Sale', promotions: 'Promotions', general: 'General' };
export const ALERT_AREAS = ['all', 'Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Enugu', 'Kaduna', 'Benin City'];
export const MAX_ALERTS_PER_EMAIL = 5;

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

/** Returns { value } or { error } for an alert request body. */
export function cleanAlert(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.' };
  const category = Object.hasOwn(ALERT_CATEGORIES, body?.category) ? body.category : 'all';
  const area = ALERT_AREAS.includes(body?.area) ? body.area : 'all';
  const keyword = String(body?.keyword || '').replace(/[^\p{L}\p{N}&' -]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
  return { value: { email, category, area, keyword } };
}

/** Whether a post matches an alert (the cron's query already narrows by category and date). */
export function matches(alert, post) {
  if (alert.category !== 'all' && post.category !== alert.category) return false;
  if (alert.area !== 'all') {
    const place = String(post.location || '').toLowerCase();
    const area = alert.area.toLowerCase();
    if (!place.startsWith(area) && !(area === 'abuja' && /\bfct\b/.test(place))) return false;
  }
  if (alert.keyword) {
    const text = `${post.title} ${post.description || ''}`.toLowerCase();
    if (!alert.keyword.toLowerCase().split(' ').every(word => text.includes(word))) return false;
  }
  return true;
}

export function describeAlert(alert) {
  const what = alert.category === 'all' ? 'new posts' : `new ${ALERT_CATEGORIES[alert.category]} posts`;
  return `${what}${alert.keyword ? ` mentioning “${alert.keyword}”` : ''}${alert.area === 'all' ? ' anywhere in Nigeria' : ` in ${alert.area}`}`;
}
