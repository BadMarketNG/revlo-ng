// Social posting (2026-10-02): a daily "Today on Revlo" post to Revlo's own Facebook Page and X account.
// Each switches on when its keys are set in Vercel:
//   Facebook: FB_PAGE_ID, FB_PAGE_ACCESS_TOKEN (a long-lived Page token), optional FB_GRAPH_VERSION
//   X:        X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (OAuth 1.0a, app with write access)
// Posts only counts and Revlo links; partner sources are never named.
import crypto from 'crypto';

// "Fri 2 Oct" in Lagos time. Each day's post is dated, so X never sees two identical posts.
export function lagosDay(now = Date.now()) {
  const d = new Date(now + 3600000);
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
}

const LABELS = [['jobs', 'job', 'jobs'], ['rentals', 'room or rental', 'rooms and rentals'], ['for_sale', 'item for sale', 'items for sale'], ['promotions', 'promotion', 'promotions'], ['general', 'other post', 'other posts']];

/** The daily message. `counts` is { jobs: 12, rentals: 5, … } for posts created in the last 24 hours. */
export function buildDigest(counts, { url = 'https://revlo.ng', bookable = 0, now = Date.now() } = {}) {
  const lines = LABELS.filter(([key]) => counts[key] > 0).map(([key, one, many]) => `• ${counts[key]} ${counts[key] === 1 ? one : many}`);
  if (!lines.length) return null;
  const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  return [
    `Today on Revlo (${lagosDay(now)}): ${total} new post${total === 1 ? '' : 's'} across Nigeria`,
    '',
    ...lines,
    ...(bookable ? ['', `📅 ${bookable} you can book a viewing or call for online`] : []),
    '',
    'Free to post, no sign-up. Posts expire, so look today 👇',
    url,
  ].join('\n');
}

/** A shorter version for X (280 characters; a link counts as 23). */
export function buildShortDigest(counts, { url = 'https://revlo.ng', now = Date.now() } = {}) {
  const parts = LABELS.filter(([key]) => counts[key] > 0).map(([key, one, many]) => `${counts[key]} ${counts[key] === 1 ? one : many}`);
  if (!parts.length) return null;
  let text = `New on Revlo, ${lagosDay(now)}: ${parts.join(', ')}. Free to post, no sign-up. Look before they expire:`;
  if (text.length > 280 - 24) text = `${text.slice(0, 280 - 26)}…`;
  return `${text} ${url}`;
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
