// "From X" strip (2026-10-03): which X searches to run and how to read the results.
// Cost: X charges per post read. Visitors never trigger X calls; a scheduled job does, within caps.

export const PRICE_PER_POST_USD = () => Number(process.env.X_PRICE_PER_POST || 0.005);
export const MONTHLY_CAP_USD = () => Number(process.env.X_FEED_MONTHLY_USD || 20);
export const DAILY_POST_CAP = () => Math.max(10, Math.floor(Number(process.env.X_FEED_DAILY_POSTS || 120)));
export const BLOCK_POST_CAP = 50;          // most posts pulled per category/city block per refresh
export const KEEP_HOURS = 48;              // cached posts are kept this long

export const X_CITIES = ['Lagos', 'Abuja', 'Port Harcourt'];

// Search terms per Revlo category. Original posts only (no reposts or replies).
export const X_QUERIES = {
  jobs: '(hiring OR vacancy OR "job opening" OR "we are recruiting")',
  rentals: '("to let" OR "for rent" OR "apartment for rent" OR "self contain" OR shortlet)',
  for_sale: '("for sale" OR "selling my" OR "now selling")',
  gadgets: '(phone OR iphone OR laptop OR gadget OR samsung) ("for sale" OR selling)',
  electronics: '(tv OR fridge OR generator OR inverter OR "sound system") ("for sale" OR selling)',
  wears: '(clothes OR shoes OR sneakers OR dress OR thrift) ("for sale" OR selling)',
  vehicles: '(car OR toyota OR honda OR lexus OR tokunbo) ("for sale" OR selling)',
  repairs: '(repair OR technician OR "we fix") (phone OR laptop OR car OR ac OR generator)',
  promotions: '(promo OR discount OR "% off" OR giveaway)',
};

export const blockKey = (category, city) => `${category}:${city}`;
export function buildQuery(category, city) {
  const terms = X_QUERIES[category];
  if (!terms) return null;
  return `${terms} "${city}" -is:retweet -is:reply lang:en`;
}

/** All blocks, rotated so each refresh starts somewhere different (fair use of a small daily cap). */
export function blocksForRun(runIndex) {
  const all = Object.keys(X_QUERIES).flatMap(category => X_CITIES.map(city => ({ category, city, key: blockKey(category, city) })));
  const start = (runIndex * 7) % all.length;
  return [...all.slice(start), ...all.slice(0, start)];
}

/** Normalises an X recent-search response into cached posts (text unedited, as X requires). */
export function parseSearch(body, { category, city }) {
  const users = new Map((body?.includes?.users || []).map(u => [u.id, u]));
  const media = new Map((body?.includes?.media || []).map(m => [m.media_key, m]));
  return (body?.data || []).map(tweet => {
    const user = users.get(tweet.author_id);
    if (!user || !tweet.text) return null;
    const firstMedia = (tweet.attachments?.media_keys || []).map(k => media.get(k)).find(Boolean);
    return {
      id: String(tweet.id),
      block_key: blockKey(category, city),
      category, city,
      text: String(tweet.text).slice(0, 1000),
      author_name: String(user.name || user.username).slice(0, 80),
      author_username: String(user.username).slice(0, 40),
      author_avatar: /^https:\/\//.test(user.profile_image_url || '') ? user.profile_image_url : null,
      media_url: firstMedia ? (firstMedia.url || firstMedia.preview_image_url || null) : null,
      posted_at: tweet.created_at || new Date().toISOString(),
    };
  }).filter(Boolean);
}

/** How many posts may still be read today and this month, given usage so far. */
export function remainingBudget({ todayRead, monthRead }) {
  const byDay = DAILY_POST_CAP() - todayRead;
  const byMonth = Math.floor(MONTHLY_CAP_USD() / PRICE_PER_POST_USD()) - monthRead;
  return Math.max(0, Math.min(byDay, byMonth));
}
