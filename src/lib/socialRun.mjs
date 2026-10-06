import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { buildDigest, buildShortDigest, postToFacebook, postToX, socialCardForCounts } from '@/lib/socialPost.mjs';
import { getSocialSettings, platformIsDue } from '@/lib/socialSettings.mjs';
import { headline } from '@/lib/outcomes.mjs';

export function socialPlatformConfiguration() {
  return {
    x: Boolean(process.env.X_API_KEY && process.env.X_API_SECRET && process.env.X_ACCESS_TOKEN && process.env.X_ACCESS_SECRET),
    facebook: Boolean(process.env.FB_PAGE_ID && process.env.FB_PAGE_ACCESS_TOKEN),
  };
}

export async function runSocialPublishing({ force = false, now = new Date() } = {}) {
  const settings = await getSocialSettings(supabaseAdmin);
  const configured = socialPlatformConfiguration();
  const due = {
    x: settings.xEnabled && configured.x && (force || platformIsDue(settings.lastXAt, settings.intervalHours, now.getTime())),
    facebook: settings.facebookEnabled && configured.facebook && (force || platformIsDue(settings.lastFacebookAt, settings.intervalHours, now.getTime())),
  };
  const status = {
    x: !settings.xEnabled ? 'disabled' : !configured.x ? 'not configured' : due.x ? 'ready' : 'waiting',
    facebook: !settings.facebookEnabled ? 'disabled' : !configured.facebook ? 'not configured' : due.facebook ? 'ready' : 'waiting',
  };
  if (!due.x && !due.facebook) return { settings, configured, status, counts: {}, results: {} };

  const since = new Date(now.getTime() - settings.intervalHours * 3_600_000).toISOString();
  const { data: posts, error } = await supabaseAdmin.from('posts')
    .select('uid,category')
    .is('deleted_at', null)
    .gt('expires_at', now.toISOString())
    .gte('created_at', since)
    .in('category', settings.categories)
    .limit(5000);
  if (error) throw new Error('Unable to read posts for social publishing.');
  const counts = {};
  for (const post of posts || []) counts[post.category] = (counts[post.category] || 0) + 1;
  if (!Object.keys(counts).length) return { settings, configured, status: { ...status, x: due.x ? 'no new posts' : status.x, facebook: due.facebook ? 'no new posts' : status.facebook }, counts, results: {} };

  const [{ count: bookable }, { data: shared }] = await Promise.all([
    (posts || []).length
      ? supabaseAdmin.from('revlo_booking_settings').select('post_uid', { count: 'exact', head: true }).in('post_uid', posts.map(post => post.uid).slice(0, 1000))
      : Promise.resolve({ count: 0 }),
    supabaseAdmin.from('revlo_outcomes').select('outcome,label,hours').eq('share', true).gte('resolved_at', since).order('hours').limit(3),
  ]);
  const resultsText = (shared || []).map(result => `${headline(result.outcome, Number(result.hours))}: ${result.label}`);
  const card = socialCardForCounts(counts, now.getTime());
  const link = 'https://revlo.ng/app.html?utm_source=social&utm_medium=scheduled';
  const long = buildDigest(counts, { url: link, bookable: bookable || 0, results: resultsText, now: now.getTime(), hashtags: settings.hashtags });
  const short = buildShortDigest(counts, { url: `https://revlo.ng/today/${card.slug}`, now: now.getTime(), hashtags: settings.hashtags });
  const outcomes = {};
  if (due.facebook) outcomes.facebook = await postToFacebook(long, link).catch(error_ => ({ ok: false, error: error_?.name || 'Error' }));
  if (due.x) outcomes.x = await postToX(short).catch(error_ => ({ ok: false, error: error_?.name || 'Error' }));

  const sentPlatforms = ['x', 'facebook'].filter(platform => outcomes[platform]?.ok);
  if (sentPlatforms.length) await supabaseAdmin.from('admin_log').insert({ action: 'social_publishing_sent', target_uid: 'social-publishing', detail: { platforms: sentPlatforms, counts } });
  return { settings, configured, status, counts, results: outcomes };
}
