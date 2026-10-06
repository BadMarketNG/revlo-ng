export const SOCIAL_INTERVALS = [1, 3, 6, 12, 24, 48, 72, 168];

export const DEFAULT_SOCIAL_SETTINGS = Object.freeze({
  xEnabled: true,
  facebookEnabled: true,
  categories: ['jobs', 'rentals', 'for_sale', 'promotions', 'general'],
  intervalHours: 24,
  hashtags: [],
  feedDescription: '',
  lastXAt: null,
  lastFacebookAt: null,
});

export function normalizeFeedDescription(input) {
  return String(input || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function normalizeHashtags(input) {
  const values = Array.isArray(input) ? input : String(input || '').split(/[\s,]+/);
  return [...new Set(values
    .map(value => String(value).trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 32))
    .filter(Boolean))]
    .slice(0, 8);
}

export function normalizeSocialSettings(row = {}) {
  const hours = Number(row.interval_hours ?? row.intervalHours);
  return {
    xEnabled: row.x_enabled ?? row.xEnabled ?? DEFAULT_SOCIAL_SETTINGS.xEnabled,
    facebookEnabled: row.facebook_enabled ?? row.facebookEnabled ?? DEFAULT_SOCIAL_SETTINGS.facebookEnabled,
    categories: Array.isArray(row.categories) ? [...new Set(row.categories.map(String).filter(Boolean))] : [...DEFAULT_SOCIAL_SETTINGS.categories],
    intervalHours: SOCIAL_INTERVALS.includes(hours) ? hours : DEFAULT_SOCIAL_SETTINGS.intervalHours,
    hashtags: normalizeHashtags(row.hashtags),
    feedDescription: normalizeFeedDescription(row.feed_description ?? row.feedDescription),
    lastXAt: row.last_x_at ?? row.lastXAt ?? null,
    lastFacebookAt: row.last_facebook_at ?? row.lastFacebookAt ?? null,
  };
}

export async function getSocialSettings(db) {
  const [{ data: saved, error: settingsError }, { data: sent, error: sentError }] = await Promise.all([
    db.from('admin_log').select('detail').eq('action', 'social_publishing_settings').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('admin_log').select('detail,created_at').eq('action', 'social_publishing_sent').order('created_at', { ascending: false }).limit(100),
  ]);
  if (settingsError || sentError) {
    console.error('[social-settings:read]', settingsError?.message || sentError?.message || settingsError || sentError);
    return normalizeSocialSettings();
  }
  const settings = normalizeSocialSettings(saved?.detail || {});
  const lastFor = platform => (sent || []).find(event => Array.isArray(event.detail?.platforms) && event.detail.platforms.includes(platform))?.created_at || null;
  return { ...settings, lastXAt: lastFor('x'), lastFacebookAt: lastFor('facebook') };
}

export function platformIsDue(lastSentAt, intervalHours, now = Date.now()) {
  if (!lastSentAt) return true;
  const sent = Date.parse(lastSentAt);
  return !Number.isFinite(sent) || now - sent >= intervalHours * 3_600_000;
}

export function hashtagSuffix(hashtags) {
  const normalized = normalizeHashtags(hashtags);
  return normalized.length ? normalized.map(tag => `#${tag}`).join(' ') : '';
}
