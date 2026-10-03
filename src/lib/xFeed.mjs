// "From X" strip (2026-10-03): which X searches to run and how to read the results.
// Cost: X charges per post read. Visitors never trigger X calls; a scheduled job does, within caps.

export const PRICE_PER_POST_USD = () => Number(process.env.X_PRICE_PER_POST || 0.005);
export const MONTHLY_CAP_USD = () => Number(process.env.X_FEED_MONTHLY_USD || 20);
// ORIGINAL (2026-10-03): a daily cap (X_FEED_DAILY_POSTS posts per day).
// NOTE (owner's request): the budget renews every PERIOD_DAYS (default 3); X_FEED_DAILY_POSTS is now the
// number of posts per period.
export const PERIOD_DAYS = () => Math.max(1, Math.floor(Number(process.env.X_FEED_PERIOD_DAYS || 3)));
export const PERIOD_POST_CAP = () => Math.max(10, Math.floor(Number(process.env.X_FEED_DAILY_POSTS || 120)));
export const DAILY_POST_CAP = PERIOD_POST_CAP; // kept for older callers
/** First day (YYYY-MM-DD) of the budget period containing `now`. Periods are aligned to the calendar. */
export function periodStart(now = Date.now()) {
  const day = Math.floor(now / 86400000);
  return new Date((day - (day % PERIOD_DAYS())) * 86400000).toISOString().slice(0, 10);
}
// ORIGINAL (2026-10-03, first run): 50 per block let the first three blocks use the whole day's cap.
export const BLOCK_POST_CAP = 10;          // most posts pulled per category/city block per refresh
export const RUNS_PER_DAY = 4;             // the refresh runs every 6 hours; each gets an even share of the period's cap
export const KEEP_HOURS = 48;              // cached posts are kept this long

export const X_CITIES = ['Lagos', 'Abuja', 'Port Harcourt'];

// ORIGINAL (2026-10-03, first version): nine category searches (jobs, rentals, for sale, gadgets,
// electronics, wears, vehicles, repairs, promotions) in every city. NOTE: refocused on the owner's four
// priorities: jobs, rent, items for sale (one broad search) and politics (news outlets only).
export const X_QUERIES_ORIGINAL = {
  jobs: '(hiring OR vacancy OR "job opening" OR "we are recruiting")',
  rentals: '("to let" OR "for rent" OR "apartment for rent" OR "self contain" OR shortlet)',
  for_sale: '("for sale" OR "selling my" OR "now selling")',
  gadgets: '(phone OR iphone OR laptop OR gadget OR samsung) ("for sale" OR selling)',
  electronics: '(tv OR fridge OR generator OR inverter OR "sound system") ("for sale" OR selling)',
  wears: '(clothes OR shoes OR sneakers OR dress OR thrift) ("for sale" OR selling)',
  vehicles: '(car OR toyota OR honda OR lexus OR tokunbo) ("for sale" OR selling)',
  repairs: '(repair OR technician OR "we fix") (phone OR laptop OR car OR ac OR generator)',
  // ORIGINAL (2026-10-03): '(promo OR discount OR "% off" OR giveaway)' matched general chatter.
  promotions: '(promo OR discount OR "% off") (shop OR store OR order OR price OR dm)',
};

// Politics comes only from established news outlets' accounts, to keep rumours and abuse out.
export const POLITICS_ACCOUNTS = ['PremiumTimesng', 'channelstv', 'MobilePunch', 'vanguardngrnews', 'TheCableng', 'BBCNewsPidgin', 'ARISEtv'];
export const X_QUERIES = {
  jobs: X_QUERIES_ORIGINAL.jobs,
  rentals: X_QUERIES_ORIGINAL.rentals,
  for_sale: '("for sale" OR selling OR "now selling" OR "dm for price") (phone OR laptop OR car OR shoes OR clothes OR tv OR generator OR furniture OR iphone)',
  politics: `(${POLITICS_ACCOUNTS.map(a => `from:${a}`).join(' OR ')}) (election OR senate OR governor OR president OR INEC OR assembly OR minister OR party OR tinubu OR policy)`,
};
// Politics is national (one search); the others run per city.
const NATIONAL = new Set(['politics']);

// Which X posts a Revlo category shows (item categories all show the broad "for sale" search).
// Promotions posts already read (and paid for) keep showing until they expire, though no new
// Promotions searches run (2026-10-03).
export const SHOWN_FOR = { all: ['jobs', 'rentals', 'for_sale', 'politics', 'promotions'], jobs: ['jobs'], rentals: ['rentals'], for_sale: ['for_sale'], gadgets: ['for_sale'], electronics: ['for_sale'], wears: ['for_sale'], vehicles: ['for_sale'], general: ['politics'], promotions: ['promotions'] };

export const blockKey = (category, city) => `${category}:${city}`;

// Relevance check (2026-10-03): X search also matches loosely related posts, so a post is kept and shown
// only if its own text has the category's listing words and names the city.
const RELEVANT = {
  jobs: /\b(hiring|vacanc(y|ies)|job opening|recruiting|apply)\b/i,
  rentals: /\b(to let|for rent|apartment|self[- ]?contain|shortlet|bedroom|flat)\b/i,
  for_sale: /\b(for sale|selling|price|₦|naira)\b/i,
  gadgets: /\b(phone|iphone|laptop|gadget|samsung|ipad|airpods)\b/i,
  electronics: /\b(tv|television|fridge|freezer|generator|inverter|sound system|speaker)\b/i,
  wears: /\b(clothes|shoes|sneakers|dress|thrift|wear|bags?)\b/i,
  vehicles: /\b(car|toyota|honda|lexus|tokunbo|benz|camry|corolla)\b/i,
  repairs: /\b(repair|technician|we fix|fixing|servicing)\b/i,
  promotions: /\b(promo|discount|% off|\d+%\s?off)\b/i,
  politics: /\b(election|senate|senator|governor|president|presidency|inec|assembly|minister|party|tinubu|policy|lawmakers?|reps)\b/i,
};
const SALE_WORDS = /\b(for sale|selling|price|₦|naira|dm|order)\b/i;
export function isRelevant(post) {
  const text = String(post.text || '');
  const pattern = RELEVANT[post.category];
  if (!pattern || !pattern.test(text)) return false;
  if (NATIONAL.has(post.category)) return true;
  if (!new RegExp(`\\b${String(post.city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) return false;
  // Item categories must also read like a sale.
  if (['gadgets', 'electronics', 'wears', 'vehicles'].includes(post.category) && !SALE_WORDS.test(text)) return false;
  return true;
}
export function buildQuery(category, city) {
  const terms = X_QUERIES[category];
  if (!terms) return null;
  return NATIONAL.has(category) ? `${terms} -is:retweet -is:reply` : `${terms} "${city}" -is:retweet -is:reply lang:en`;
}

/** All blocks, rotated so each refresh starts somewhere different (fair use of a small daily cap). */
export function blocksForRun(runIndex) {
  const all = Object.keys(X_QUERIES).flatMap(category => (NATIONAL.has(category) ? ['Nigeria'] : X_CITIES).map(city => ({ category, city, key: blockKey(category, city) })));
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
    // ORIGINAL (2026-10-03): only the first photo was kept. NOTE: the first photo is the header and the
    // second photo (or the author's full-size profile picture) is the icon.
    const photos = (tweet.attachments?.media_keys || []).map(k => media.get(k)).filter(Boolean).map(m => m.url || m.preview_image_url).filter(u => /^https:\/\//.test(u || ''));
    const firstMedia = photos.length ? { url: photos[0] } : null;
    const avatar = /^https:\/\//.test(user.profile_image_url || '') ? user.profile_image_url.replace('_normal.', '_400x400.') : null;
    return {
      id: String(tweet.id),
      block_key: blockKey(category, city),
      category, city,
      text: String(tweet.text).slice(0, 1000),
      author_name: String(user.name || user.username).slice(0, 80),
      author_username: String(user.username).slice(0, 40),
      author_avatar: /^https:\/\//.test(user.profile_image_url || '') ? user.profile_image_url : null,
      media_url: firstMedia ? firstMedia.url : null,
      icon_url: photos[1] || avatar,
      posted_at: tweet.created_at || new Date().toISOString(),
    };
  }).filter(Boolean);
}

/** How many posts may still be read today and this month, given usage so far. */
// todayRead is the number read so far in the current budget period (name kept from the daily version).
export function remainingBudget({ todayRead, monthRead, runRead = 0 }) {
  const byDay = PERIOD_POST_CAP() - todayRead;
  // Each run may use only its share of the period's cap, so every category and city gets a turn.
  const byRun = Math.max(10, Math.ceil(PERIOD_POST_CAP() / (RUNS_PER_DAY * PERIOD_DAYS()))) - runRead;
  const byMonth = Math.floor(MONTHLY_CAP_USD() / PRICE_PER_POST_USD()) - monthRead;
  return Math.max(0, Math.min(byDay, byMonth, byRun));
}

// X posts as Revlo posts (2026-10-03, owner's request): created by support@revlo.ng through the normal post
// fields, with the author credited and the text unedited (X's rules). They are ordinary Revlo posts
// (contact goes to support@revlo.ng); posts last 24 hours (removed well within X's deletion window).
const REVLO_PLACES = ['Lagos, Nigeria', 'Abuja FCT', 'Port Harcourt, Rivers'];
const HEADERS = { jobs: ['jobs-1', 'jobs-2', 'jobs-3', 'jobs-4', 'jobs-5'], rentals: ['rentals-2', 'rentals-3', 'rentals-5'], for_sale: ['for_sale-3', 'for_sale-4', 'for_sale-5'], promotions: ['promotions-1', 'promotions-2', 'promotions-4', 'promotions-5'], general: ['general-1', 'general-3', 'general-4'] };
const ICONS = ['01', '07', '12', '13', '14'];
const seedOf = text => [...String(text)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const xPostUrl = post => `https://x.com/${encodeURIComponent(post.author_username)}/status/${encodeURIComponent(post.id)}`;

export function xToPost(post, origin = 'https://revlo.ng') {
  const category = post.category === 'politics' ? 'general' : post.category;
  const firstLine = String(post.text).split('\n').map(l => l.trim()).find(l => /[\p{L}\p{N}]{3,}/u.test(l)) || post.text;
  const clean = firstLine.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  const title = (clean.length > 110 ? `${clean.slice(0, 107).replace(/\s+\S*$/, '')}…` : clean) || `Post from @${post.author_username}`;
  const place = REVLO_PLACES.find(p => p.toLowerCase().startsWith(String(post.city).toLowerCase())) || 'Nigeria';
  const seed = seedOf(post.id);
  const headers = HEADERS[category] || HEADERS.general;
  return {
    title: title.slice(0, 200),
    // ORIGINAL (2026-10-03): ended with 'Posted on X by Name (@handle): link'. Removed at the owner's request;
    // the owner is implementing attribution their own way (revlo_x_posts keeps the author and link).
    description: String(post.text).slice(0, 5000),
    location: place,
    category,
    header_url: post.media_url && /^https:\/\/pbs\.twimg\.com\//.test(post.media_url) ? post.media_url : `${origin}/samples/headers/${headers[seed % headers.length]}.jpg`,
    // Posts saved before icon_url existed fall back to the author's saved picture (full size).
    thumb_url: [post.icon_url, post.author_avatar && String(post.author_avatar).replace('_normal.', '_400x400.')].find(u => u && /^https:\/\/pbs\.twimg\.com\//.test(u)) || `${origin}/samples/icons/icon-${ICONS[(seed >> 3) % ICONS.length]}.jpg`,
    tags: ['x', category.replace('_', ' ')].filter(t => /^[a-z][a-z ]{1,30}$/.test(t)),
  };
}
