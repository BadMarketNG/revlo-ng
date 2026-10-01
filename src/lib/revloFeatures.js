import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normaliseEmail } from '@/lib/revloBlocklist';

export const DEFAULT_FEATURE_SETTINGS = Object.freeze({
  silver_posts: 100,
  bronze_posts: 500,
  gold_posts: 1500,
  normal_link_posts: 5,
  silver_link_posts: 50,
  bronze_link_posts: 100,
  gold_link_posts: 200,
  premium_min_posts: 10,
  premium_price_kobo: 500000,
  premium_days: 30,
  promotions_enabled: true,
  promo_price_per_day_kobo: 100000,
  promo_min_days: 1,
  promo_max_days: 30,
  // NOTE (2026-10-01): follower contact, suspension and search-tag limits.
  normal_follower_contacts: 1,
  suspension_default_days: 10,
  tags_normal: 1,
  tags_bronze: 2,
  tags_silver: 3,
  tags_gold: 4,
  tags_promoted: 5,
});

export async function getFeatureSettings() {
  const { data, error } = await supabaseAdmin.from('revlo_feature_settings').select('*').eq('id', true).maybeSingle();
  if (error) console.error('[revloFeatures:settings]', error);
  return { ...DEFAULT_FEATURE_SETTINGS, ...(data || {}) };
}

export function earnedBadge(count, settings, override = null) {
  // ORIGINAL (commented out 2026-09-29): if (override) return override;
  // NOTE: 'none' is an administrator removal and means no badge at any post count.
  if (override === 'none') return null;
  if (override) return override;
  if (count >= settings.gold_posts) return 'gold';
  if (count >= settings.bronze_posts) return 'bronze';
  if (count >= settings.silver_posts) return 'silver';
  return null;
}

export async function getPublisherStatus(email) {
  const cleanEmail = normaliseEmail(email);
  const settings = await getFeatureSettings();
  const now = new Date().toISOString();
  const [{ data: stats }, { data: premium }] = await Promise.all([
    supabaseAdmin.from('revlo_publisher_stats').select('published_posts,badge_override,alias').eq('email', cleanEmail).maybeSingle(),
    supabaseAdmin.from('revlo_premium_badges').select('active_until').eq('email', cleanEmail).gt('active_until', now).maybeSingle(),
  ]);
  const publishedPosts = stats?.published_posts || 0;
  const trustBadge = earnedBadge(publishedPosts, settings, stats?.badge_override);
  return {
    publishedPosts,
    trustBadge,
    // NOTE (2026-09-29): exposed so new posts and the admin panel respect administrator overrides.
    badgeOverride: stats?.badge_override || null,
    // NOTE (2026-09-30): the publisher's public alias, pre-filled in the post form.
    alias: stats?.alias || null,
    earnedTrustBadge: earnedBadge(publishedPosts, settings),
    premiumActive: Boolean(premium),
    premiumUntil: premium?.active_until || null,
    videoEligible: Boolean(trustBadge),
    premiumEligible: publishedPosts >= settings.premium_min_posts,
    settings: publicSettings(settings),
  };
}

export function publicSettings(settings) {
  return {
    silver_posts: settings.silver_posts,
    bronze_posts: settings.bronze_posts,
    gold_posts: settings.gold_posts,
    normal_link_posts: settings.normal_link_posts,
    silver_link_posts: settings.silver_link_posts,
    bronze_link_posts: settings.bronze_link_posts,
    gold_link_posts: settings.gold_link_posts,
    premium_min_posts: settings.premium_min_posts,
    premium_price_kobo: settings.premium_price_kobo,
    premium_days: settings.premium_days,
    promotions_enabled: settings.promotions_enabled,
    promo_price_per_day_kobo: settings.promo_price_per_day_kobo,
    promo_min_days: settings.promo_min_days,
    promo_max_days: settings.promo_max_days,
    normal_follower_contacts: settings.normal_follower_contacts,
    tags_normal: settings.tags_normal,
    tags_bronze: settings.tags_bronze,
    tags_silver: settings.tags_silver,
    tags_gold: settings.tags_gold,
    tags_promoted: settings.tags_promoted,
  };
}

export async function incrementPublisherPosts(email) {
  const { data, error } = await supabaseAdmin.rpc('increment_revlo_publisher_posts', { p_email: normaliseEmail(email) });
  if (error) throw error;
  return data;
}

// ── Publish link allowance by badge (2026-09-29) ─────────────────────────────
// Posts one emailed publish link can create. Badge links have no time limit;
// normal links allow one post within 30 minutes.
export const PUBLISH_LINK_ALLOWANCE = Object.freeze({ silver: 50, bronze: 100, gold: 200 });
export const NORMAL_LINK_MINUTES = 30;

// ORIGINAL (commented out 2026-09-29): fixed allowances only.
// export function publishLinkAllowance(trustBadge) {
//   return PUBLISH_LINK_ALLOWANCE[trustBadge] || 1;
// }
// NOTE: administrators set the allowances in Badges & Promos; PUBLISH_LINK_ALLOWANCE
// is the fallback when settings are unavailable.
export const NORMAL_LINK_POSTS = 5;

export function publishLinkAllowance(trustBadge, settings = null) {
  // ORIGINAL (commented out 2026-09-29): if (!trustBadge || !PUBLISH_LINK_ALLOWANCE[trustBadge]) return 1;
  // NOTE: publishers without a badge now start with 5 posts per link (30-minute link), administrator-set.
  if (!trustBadge || !PUBLISH_LINK_ALLOWANCE[trustBadge]) {
    const normal = Math.floor(Number(settings?.normal_link_posts));
    return Number.isFinite(normal) && normal >= 1 ? Math.min(normal, 1000) : NORMAL_LINK_POSTS;
  }
  const configured = Math.floor(Number(settings?.[`${trustBadge}_link_posts`]));
  return Number.isFinite(configured) && configured >= 1 ? Math.min(configured, 1000) : PUBLISH_LINK_ALLOWANCE[trustBadge];
}
