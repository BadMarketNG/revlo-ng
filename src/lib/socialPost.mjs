// Social posting (2026-10-02): a daily "Today on Revlo" post to Revlo's own Facebook Page and X account.
// Each switches on when its keys are set in Vercel:
//   Facebook: FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN (a long-lived Page token), optional FB_GRAPH_VERSION
//   X:        X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (OAuth 1.0a, app with write access)
// Posts only counts and Revlo links; partner sources are never named.
import crypto from 'crypto';
import { hashtagSuffix } from '@/lib/socialSettings.mjs';

// "Fri 2 Oct" in Lagos time. Each day's post is dated, so X never sees two identical posts.
export function lagosDay(now = Date.now()) {
  const d = new Date(now + 3600000);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
}

const LABELS = { jobs: ['job', 'jobs'], rentals: ['room or rental', 'rooms and rentals'], for_sale: ['item for sale', 'items for sale'], promotions: ['promotion', 'promotions'], general: ['other post', 'other posts'] };
const categoryWords = key => String(key || '').replace(/_/g, ' ').trim();
const categoryLine = (key, count) => {
  const [one, many] = LABELS[key] || [categoryWords(key), `${categoryWords(key)} posts`];
  return `${count} ${count === 1 ? one : many}`;
};

/** The daily message. `counts` is { jobs: 12, rentals: 5, … } for posts created in the last 24 hours. */
export function buildDigest(counts, { url = 'https://revlo.ng', bookable = 0, now = Date.now(), results = [], hashtags = [] } = {}) {
  const lines = Object.entries(counts).filter(([, count]) => count > 0).map(([key, count]) => `• ${categoryLine(key, count)}`);
  if (!lines.length) return null;
  const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  return [
    `Today on Revlo (${lagosDay(now)}): ${total} new post${total === 1 ? '' : 's'} across Nigeria`,
    '',
    ...lines,
    ...(bookable ? ['', `📅 ${bookable} you can book a viewing or call for online`] : []),
    // Real results the posters agreed to share, e.g. "✓ Let in 3 hours: 2-bedroom flat · Yaba".
    ...(results.length ? ['', 'Gone already:', ...results.slice(0, 3).map(r => `✓ ${r}`)] : []),
    '',
    'Free to post, no sign-up. Posts expire, so look today 👇',
    ...(hashtagSuffix(hashtags) ? [hashtagSuffix(hashtags)] : []),
    url,
  ].join('\n');
}

/** A shorter version for X (280 characters; a link counts as 23). */
export function buildShortDigest(counts, { url = 'https://revlo.ng', now = Date.now(), hashtags = [] } = {}) {
  const parts = Object.entries(counts).filter(([, count]) => count > 0).map(([key, count]) => categoryLine(key, count));
  if (!parts.length) return null;
  const lead = counts.jobs ? 'Looking for work?' : counts.rentals ? 'Looking for a place?' : counts.for_sale ? 'Looking for a deal?' : 'See what is new in Nigeria.';
  const tags = hashtagSuffix(hashtags);
  let text = `${lead} New on Revlo, ${lagosDay(now)}: ${parts.join(', ')}. Browse while they are live:`;
  const suffix = ` ${url}${tags ? `\n${tags}` : ''}`;
  const maxLead = Math.max(40, 280 - suffix.length);
  if (text.length > maxLead) text = `${text.slice(0, maxLead - 1)}…`;
  return `${text}${suffix}`;
}

// These are existing, licensed real stock photos, shown as illustrations of
// categories rather than pictures of any particular listing.
const SOCIAL_CARDS = {
  jobs: ['/samples/headers/jobs-1.jpg', '/samples/headers/jobs-p36766701.jpg', '/samples/headers/jobs-p36765731.jpg'],
  rentals: ['/samples/headers/rentals-2.jpg', '/samples/headers/rentals-3.jpg'],
  for_sale: ['/samples/headers/for_sale-3.jpg', '/samples/headers/for_sale-4.jpg'],
};

export function socialCardForCounts(counts, now = Date.now()) {
  const category = ['jobs', 'rentals', 'for_sale'].sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
  const selected = counts[category] ? category : 'jobs';
  const day = new Date(now + 3600000).toISOString().slice(0, 10);
  const index = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000) % SOCIAL_CARDS[selected].length;
  return { slug: `${day}-${selected}-${index + 1}`, category, image: SOCIAL_CARDS[selected][index] };
}

export function socialCardFromSlug(slug) {
  const match = /^(\d{4}-\d{2}-\d{2})-(jobs|rentals|for_sale)-([1-3])$/.exec(String(slug || ''));
  if (!match) return null;
  const image = SOCIAL_CARDS[match[2]][Number(match[3]) - 1];
  return image ? { date: match[1], category: match[2], image } : null;
}

const enc = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** OAuth 1.0a Authorization header (HMAC-SHA1). `params` are query/form parameters that are signed. */
export function oauth1Header({ method, url, params = {}, consumerKey, consumerSecret, token, tokenSecret, nonce = crypto.randomBytes(16).toString('hex'), timestamp = Math.floor(Date.now() / 1000) }) {
  const oauth = { oauth_consumer_key: consumerKey, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(timestamp), oauth_token: token, oauth_version: '1.0' };
  const all = { ...params, ...oauth };
  const paramString = Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join('&');
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&');
  const signature = crypto.createHmac('sha1', `${enc(consumerSecret)}&${enc(tokenSecret)}`).update(base).digest('base64');
  return `OAuth ${Object.entries({ ...oauth, oauth_signature: signature }).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ')}`;
}

export async function postToFacebook(message, link) {
  const { FB_PAGE_ID: page, FB_PAGE_ACCESS_TOKEN: token, FB_GRAPH_VERSION: version = 'v23.0' } = process.env;
  if (!page || !token) return { skipped: true };
  const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(page)}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, link, access_token: token }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, id: body.id } : { ok: false, status: response.status, error: body.error?.message?.slice(0, 200) };
}

export async function postToX(text) {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) return { skipped: true };
  const url = 'https://api.x.com/2/tweets';
  // JSON bodies are not part of the OAuth 1.0a signature.
  const authorization = oauth1Header({ method: 'POST', url, consumerKey: X_API_KEY, consumerSecret: X_API_SECRET, token: X_ACCESS_TOKEN, tokenSecret: X_ACCESS_SECRET });
  const response = await fetch(url, { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, id: body.data?.id } : { ok: false, status: response.status, error: String(body.detail || body.title || '').slice(0, 200) };
}
