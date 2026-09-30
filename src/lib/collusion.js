import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { refreshPosterFollowerCounts } from '@/lib/followerCounts';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { publicOrigin } from '@/lib/publicOrigin';
import { canonicalInbox } from '@/lib/emailIdentity';

// Collusion report (2026-09-30): estimates whether a poster's followers were
// fabricated, for example by the poster following themselves with extra email
// addresses to look trusted.
//
// For a poster P with n >= 3 followers, eight signals are each scaled 0..1:
//   D  device match      share of followers seen on a device P also used
//   I  IP match          share of followers whose follow came from an IP P used
//   C  concentration     followers sharing IPs/devices with each other
//                        (1 - (distinct - 1)/(k - 1), times coverage k/n)
//   B  burst             share of follows within 10 minutes of another follow
//   S  single-purpose    share of followers who follow only P and never post
//   V  velocity          1 - e^(-(n / max(1, account age days)) / 3)
//   Q  followers/post    1 - e^(-(n / max(1, posts)) / 5)
//   A  account youth     e^(-account age days / 14)
//   E  email failures    share of followers whose address hard-bounced or
//                        marked Revlo email as spam (from Amazon SES)
//   R  follow ring       largest share of P's followers who also follow one
//                        other poster (counted when 5+ followers overlap)
//
// E weighs heavily because following needs a confirmation click: an address
// that later bounces was a real inbox that has since been deleted.
// Added 2026-09-30: an address that reaches the poster's own inbox
// (john+1@, j.o.h.n@gmail) counts in D, and followers sharing one inbox count
// in C, using canonicalInbox() from src/lib/emailIdentity.js.
//
//   z = -4 + 3.0D + 2.5I + 1.5C + 1.5B + 1.5S + 1.0V + 1.0Q + 0.5A + 2.5E + 2.0R
//   score = 100 / (1 + e^-z)     >= 80 likely fabricated, 50-79 review, < 50 low
//
// A genuine poster typically scores under 10; one person following themselves
// from their own device and network scores above 95.
//
// Caution (2026-09-30): a follower counts as fabricated when the poster scores
// 80+ AND the follower followed from the poster's own device or inbox, shares
// an inbox with another follower, has an address that bounced or complained,
// or is single-purpose and shares the poster's IP or another follower's IP/device.
// Each time that count reaches another multiple of CAUTION_THRESHOLD (10, 20,
// 30, ...) the poster is emailed a caution, and sees a warning when creating a
// post until an administrator clears it. Every caution is kept as history.

export const WEIGHTS = Object.freeze({ D: 3.0, I: 2.5, C: 1.5, B: 1.5, S: 1.5, V: 1.0, Q: 1.0, A: 0.5, E: 2.5, R: 2.0 });
const RING_MIN_OVERLAP = 5;
export const BIAS = -4;
export const MIN_FOLLOWERS = 3;
export const CAUTION_THRESHOLD = 10;
export const CAUTION_MESSAGE = 'Our checks found that many of your followers appear to come from your own device or network, or from accounts that do nothing else on Revlo. Using extra email addresses to follow yourself misleads the community and is not allowed. Continued activity like this can lead to your posts being removed.';
const BURST_MS = 10 * 60 * 1000;
const DAY_MS = 86400000;

const lower = (value) => String(value || '').trim().toLowerCase();
const round = (value, places = 3) => Math.round(value * 10 ** places) / 10 ** places;

export function bandFor(score) {
  if (score >= 80) return 'likely_fabricated';
  if (score >= 50) return 'review';
  return 'low';
}

function concentration(values, n) {
  const present = values.filter(Boolean);
  const k = present.length;
  if (k < 2) return 0;
  const distinct = new Set(present).size;
  return (1 - (distinct - 1) / (k - 1)) * (k / n);
}

async function loadData() {
  const [follows, posts, signals] = await Promise.all([
    supabaseAdmin.from('follows').select('poster_email,follower_email,created_at,reason,reason_hidden').limit(50000),
    supabaseAdmin.from('posts').select('poster_email,created_at,source_ip').limit(50000),
    supabaseAdmin.from('revlo_activity_signals').select('kind,actor_email,subject_email,ip,device_id,created_at').limit(100000),
  ]);
  for (const result of [follows, posts, signals]) if (result.error) throw new Error('Collusion data is unavailable.');
  const events = await supabaseAdmin.from('revlo_email_events').select('email,event_type').limit(100000);
  return { follows: follows.data || [], posts: posts.data || [], signals: signals.data || [], events: events.data || [] };
}

// Only the rows one poster's score depends on: their follows, their followers'
// other follows, and posts and signals by the poster and their followers.
async function loadPosterData(poster) {
  const own = await supabaseAdmin.from('follows').select('poster_email,follower_email,created_at,reason,reason_hidden').eq('poster_email', poster).limit(5000);
  if (own.error) throw new Error('Collusion data is unavailable.');
  const people = [poster, ...new Set((own.data || []).map((row) => lower(row.follower_email)))];
  const chunks = [];
  for (let i = 0; i < people.length; i += 200) chunks.push(people.slice(i, i + 200));
  const data = { follows: [], posts: [], signals: [], events: [] };
  for (const chunk of chunks) {
    const [follows, posts, signals, events] = await Promise.all([
      supabaseAdmin.from('follows').select('poster_email,follower_email,created_at').in('follower_email', chunk).limit(20000),
      supabaseAdmin.from('posts').select('poster_email,created_at,source_ip').in('poster_email', chunk).limit(20000),
      supabaseAdmin.from('revlo_activity_signals').select('kind,actor_email,subject_email,ip,device_id,created_at').in('actor_email', chunk).limit(50000),
      supabaseAdmin.from('revlo_email_events').select('email,event_type').in('email', chunk).limit(20000),
    ]);
    for (const result of [follows, posts, signals]) if (result.error) throw new Error('Collusion data is unavailable.');
    data.follows.push(...(follows.data || []));
    data.posts.push(...(posts.data || []));
    data.signals.push(...(signals.data || []));
    data.events.push(...(events.data || []));
  }
  return data;
}

function analyse(poster, data, index) {
  const followRows = index.followsByPoster.get(poster) || [];
  const n = followRows.length;
  const posterPosts = index.postsByPoster.get(poster) || [];
  const posterSignals = (index.signalsByActor.get(poster) || []).filter((s) => s.kind === 'post' || s.kind === 'publish_link');
  const posterIps = new Set([...posterPosts.map((p) => p.source_ip), ...posterSignals.map((s) => s.ip)].filter(Boolean).map(String));
  const posterDevices = new Set(posterSignals.map((s) => s.device_id).filter(Boolean));
  const firstSeen = Math.min(...[...posterPosts.map((p) => Date.parse(p.created_at)), ...posterSignals.map((s) => Date.parse(s.created_at))].filter(Number.isFinite), Date.now());
  const ageDays = Math.max(0, (Date.now() - firstSeen) / DAY_MS);
  const postCount = posterPosts.length;

  const followers = followRows.map((row) => {
    const email = lower(row.follower_email);
    const own = (index.signalsByActor.get(email) || []).filter((s) => lower(s.subject_email) === poster);
    const request = own.find((s) => s.kind === 'follow_request');
    const confirm = own.find((s) => s.kind === 'follow_confirm');
    const ips = new Set(own.map((s) => s.ip).filter(Boolean).map(String));
    const devices = new Set(own.map((s) => s.device_id).filter(Boolean));
    const followsCount = (index.followsByFollower.get(email) || []).length;
    const postsCount = (index.postsByPoster.get(email) || []).length;
    const inbox = canonicalInbox(email);
    return {
      email,
      inbox,
      aliasOfPoster: inbox === canonicalInbox(poster),
      emailFailed: (index.eventsByEmail.get(email) || []).length > 0,
      followedAt: row.created_at,
      reason: row.reason || null,
      reasonHidden: Boolean(row.reason_hidden),
      requestIp: request?.ip ? String(request.ip) : null,
      confirmIp: confirm?.ip ? String(confirm.ip) : null,
      primaryIp: request?.ip ? String(request.ip) : confirm?.ip ? String(confirm.ip) : null,
      primaryDevice: request?.device_id || confirm?.device_id || null,
      deviceMatch: [...devices].some((d) => posterDevices.has(d)),
      ipMatch: [...ips].some((ip) => posterIps.has(ip)),
      singlePurpose: followsCount <= 1 && postsCount === 0,
      followsCount,
      postsCount,
    };
  });

  const tally = (key) => followers.reduce((map, f) => (f[key] ? map.set(f[key], (map.get(f[key]) || 0) + 1) : map), new Map());
  const ipCounts = tally('primaryIp');
  const deviceCounts = tally('primaryDevice');
  const inboxCounts = tally('inbox');
  for (const f of followers) {
    f.sharedInbox = (inboxCounts.get(f.inbox) || 0) > 1;
    f.sharesWithFollowers = (ipCounts.get(f.primaryIp) || 0) > 1 || (deviceCounts.get(f.primaryDevice) || 0) > 1 || f.sharedInbox;
    f.suspect = f.deviceMatch || f.aliasOfPoster || f.sharedInbox || f.emailFailed
      || (f.singlePurpose && (f.ipMatch || f.sharesWithFollowers));
  }

  // Follow rings: other posters followed by many of the same followers.
  const overlap = new Map();
  for (const f of followers) {
    for (const row of index.followsByFollower.get(f.email) || []) {
      const other = lower(row.poster_email);
      if (other !== poster) overlap.set(other, (overlap.get(other) || 0) + 1);
    }
  }
  const ringPartners = [...overlap.entries()]
    .filter(([, shared]) => shared >= RING_MIN_OVERLAP)
    .map(([other, shared]) => ({ poster: other, sharedFollowers: shared, share: n ? round(shared / n) : 0 }))
    .sort((a, b) => b.sharedFollowers - a.sharedFollowers)
    .slice(0, 10);

  const times = followRows.map((r) => Date.parse(r.created_at)).filter(Number.isFinite).sort((a, b) => a - b);
  const burstCount = times.filter((t, i) => (i > 0 && t - times[i - 1] <= BURST_MS) || (i < times.length - 1 && times[i + 1] - t <= BURST_MS)).length;
  const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);

  const s = n > 0 ? {
    D: followers.filter((f) => f.deviceMatch || f.aliasOfPoster).length / n,
    I: followers.filter((f) => f.ipMatch).length / n,
    C: Math.max(concentration(followers.map((f) => f.primaryIp), n), concentration(followers.map((f) => f.primaryDevice), n), concentration(followers.map((f) => f.inbox), n)),
    B: burstCount / n,
    S: followers.filter((f) => f.singlePurpose).length / n,
    V: 1 - Math.exp(-(n / Math.max(1, ageDays)) / 3),
    Q: 1 - Math.exp(-(n / Math.max(1, postCount)) / 5),
    A: Math.exp(-ageDays / 14),
    E: followers.filter((f) => f.emailFailed).length / n,
    R: ringPartners.length ? Math.min(1, ringPartners[0].sharedFollowers / n) : 0,
  } : { D: 0, I: 0, C: 0, B: 0, S: 0, V: 0, Q: 0, A: 0, E: 0, R: 0 };
  const z = BIAS + Object.entries(WEIGHTS).reduce((total, [key, weight]) => total + weight * s[key], 0);
  const score = n >= MIN_FOLLOWERS ? 100 / (1 + Math.exp(-z)) : null;

  return {
    poster,
    followers: n,
    posts: postCount,
    accountAgeDays: round(ageDays, 1),
    firstFollowAt: times.length ? new Date(times[0]).toISOString() : null,
    lastFollowAt: times.length ? new Date(times[times.length - 1]).toISOString() : null,
    followSpanHours: times.length > 1 ? round((times[times.length - 1] - times[0]) / 3600000, 1) : 0,
    medianGapMinutes: gaps.length ? round(gaps[Math.floor(gaps.length / 2)] / 60000, 1) : null,
    signals: Object.fromEntries(Object.entries(s).map(([key, value]) => [key, round(value)])),
    z: round(z, 2),
    score: score === null ? null : round(score, 1),
    band: score === null ? 'insufficient' : bandFor(score),
    fabricatedFollowers: score !== null && score >= 80 ? followers.filter((f) => f.suspect).length : 0,
    ringPartners,
    followerDetails: followers,
  };
}

function buildIndex(data) {
  const group = (rows, key) => rows.reduce((map, row) => {
    const k = lower(row[key]);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
    return map;
  }, new Map());
  return {
    followsByPoster: group(data.follows, 'poster_email'),
    followsByFollower: group(data.follows, 'follower_email'),
    postsByPoster: group(data.posts, 'poster_email'),
    signalsByActor: group(data.signals, 'actor_email'),
    eventsByEmail: group(data.events || [], 'email'),
  };
}

// Every poster with at least MIN_FOLLOWERS followers, highest score first.
export async function collusionReport() {
  const data = await loadData();
  const index = buildIndex(data);
  const cautions = await allCautions();
  return [...index.followsByPoster.keys()]
    .filter((poster) => index.followsByPoster.get(poster).length >= MIN_FOLLOWERS)
    .map((poster) => { const { followerDetails, ...row } = analyse(poster, data, index); const history = cautions.get(poster) || []; return { ...row, cautions: history, cautionActive: history.some((c) => !c.cleared_at) }; })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

// One poster in full, with followers grouped by IP address (batches under IP).
export async function collusionDetail(posterEmail) {
  const data = await loadData();
  const index = buildIndex(data);
  const result = analyse(lower(posterEmail), data, index);
  const byIp = new Map();
  for (const follower of result.followerDetails) {
    const key = follower.primaryIp || 'No IP recorded';
    if (!byIp.has(key)) byIp.set(key, []);
    byIp.get(key).push(follower);
  }
  const ipGroups = [...byIp.entries()]
    .map(([ip, followers]) => ({ ip, count: followers.length, posterUsedIp: followers.some((f) => f.ipMatch), followers }))
    .sort((a, b) => b.count - a.count);
  const history = await cautionHistory(result.poster);
  return { ...result, ipGroups, cautions: history, cautionActive: history.some((c) => !c.cleared_at) };
}

// Every caution, newest first, grouped by poster.
async function allCautions() {
  const { data } = await supabaseAdmin.from('revlo_collusion_cautions').select('*').order('cautioned_at', { ascending: false }).limit(20000);
  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.email)) map.set(row.email, []);
    map.get(row.email).push(row);
  }
  return map;
}

export async function cautionHistory(email) {
  const { data } = await supabaseAdmin.from('revlo_collusion_cautions').select('*').eq('email', lower(email)).order('cautioned_at', { ascending: false });
  return data || [];
}

// What the poster sees when creating a post (only returned with a valid publish link).
export async function cautionForPublisher(email) {
  try {
    const { data } = await supabaseAdmin.from('revlo_collusion_cautions').select('level,cautioned_at')
      .eq('email', lower(email)).is('cleared_at', null).order('cautioned_at', { ascending: false }).limit(1);
    const latest = data?.[0];
    return latest ? { message: CAUTION_MESSAGE, since: latest.cautioned_at, fabricatedFollowers: latest.level } : null;
  } catch {
    return null;
  }
}

// Called after each confirmed follow. Scores the poster and sends a caution
// each time the fabricated-follower count reaches another multiple of 10.
export async function checkPosterForCaution(posterEmail) {
  const poster = lower(posterEmail);
  try {
    const data = await loadPosterData(poster);
    const result = analyse(poster, data, buildIndex(data));
    const level = Math.floor(result.fabricatedFollowers / CAUTION_THRESHOLD) * CAUTION_THRESHOLD;
    if (level < CAUTION_THRESHOLD) return null;
    const { data: highest } = await supabaseAdmin.from('revlo_collusion_cautions').select('level')
      .eq('email', poster).order('level', { ascending: false }).limit(1);
    if ((highest?.[0]?.level || 0) >= level) return null; // this multiple of 10 was already cautioned
    const inserted = await supabaseAdmin.from('revlo_collusion_cautions')
      .insert({ email: poster, level, fabricated_followers: result.fabricatedFollowers, score: result.score })
      .select('id').maybeSingle();
    if (inserted.error || !inserted.data) return null; // another request got there first
    const count = level === CAUTION_THRESHOLD ? 'a caution' : `caution number ${level / CAUTION_THRESHOLD}`;
    const delivery = await sendEmail({
      to: poster,
      subject: 'A caution about your Revlo.ng followers',
      html: wrapEmail(`<p>This is ${count} about your Revlo followers: <strong>${result.fabricatedFollowers} of them</strong> appear to be fabricated.</p><p>${CAUTION_MESSAGE}</p><p>Followers on Revlo should be real people who chose to follow you. If you believe this is a mistake, reply to this email and our team will review it.</p><p><a href="${publicOrigin()}/rules">Read the Revlo rules</a></p>`),
      headers: { 'Reply-To': 'support@revlo.ng' },
    });
    await supabaseAdmin.from('revlo_collusion_cautions').update({ email_sent: delivery?.ok === true }).eq('id', inserted.data.id);
    await supabaseAdmin.from('admin_log').insert({
      action: 'collusion_caution',
      target_uid: `publisher:${poster}`,
      detail: { level, fabricated_followers: result.fabricatedFollowers, score: result.score, email_sent: delivery?.ok === true, automatic: true },
    });
    return result;
  } catch (error) {
    console.error('[collusion-caution]', error?.message || error);
    return null;
  }
}

// Removes the post warning. History is kept; the next multiple of 10 still cautions.
// Hides (or shows again) one follower's public note about a poster.
export async function setReasonHidden(posterEmail, followerEmail, hidden) {
  const { data, error } = await supabaseAdmin.from('follows').update({ reason_hidden: Boolean(hidden) })
    .ilike('poster_email', escapeLike(lower(posterEmail))).ilike('follower_email', escapeLike(lower(followerEmail))).select('id');
  if (error) throw new Error('Could not update the note.');
  return data?.length || 0;
}

export async function clearCaution(posterEmail, admin) {
  const { data, error } = await supabaseAdmin.from('revlo_collusion_cautions')
    .update({ cleared_at: new Date().toISOString(), cleared_by: admin?.email || admin?.sub || null })
    .eq('email', lower(posterEmail)).is('cleared_at', null).select('id');
  if (error) throw new Error('Could not clear the caution.');
  return data?.length || 0;
}

const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function deleteAllPosts(posterEmail) {
  const email = lower(posterEmail);
  const { data, error } = await supabaseAdmin.from('posts').update({ deleted_at: new Date().toISOString() })
    .ilike('poster_email', escapeLike(email)).is('deleted_at', null).select('uid');
  if (error) throw new Error('Could not delete the posts.');
  return data?.length || 0;
}

export async function removeAllFollows(posterEmail) {
  const email = lower(posterEmail);
  const { data, error } = await supabaseAdmin.from('follows').delete().ilike('poster_email', escapeLike(email)).select('id');
  if (error) throw new Error('Could not remove the follows.');
  await refreshPosterFollowerCounts(email);
  return data?.length || 0;
}

// Most suspicious first: same device as the poster, then same IP, then shared
// with other followers, then single-purpose, then the most recent follow.
function suspicionRank(f) {
  return ((f.deviceMatch || f.aliasOfPoster) ? 8 : 0) + (f.ipMatch ? 4 : 0) + (f.sharesWithFollowers ? 2 : 0) + (f.singlePurpose || f.emailFailed ? 1 : 0);
}

export function followersToRemove(followers, percent) {
  const count = Math.min(followers.length, Math.ceil((followers.length * percent) / 100));
  return [...followers]
    .sort((a, b) => suspicionRank(b) - suspicionRank(a) || Date.parse(b.followedAt) - Date.parse(a.followedAt))
    .slice(0, count);
}

// Removes the given percentage (1-100) of a poster's followers, most
// suspicious first, and returns who was removed for the admin log.
export async function removeFollowerPercentage(posterEmail, percent) {
  const poster = lower(posterEmail);
  const pct = Number(percent);
  if (!Number.isFinite(pct) || pct < 1 || pct > 100) throw new Error('Enter a percentage from 1 to 100.');
  const data = await loadPosterData(poster);
  const result = analyse(poster, data, buildIndex(data));
  const chosen = followersToRemove(result.followerDetails, pct);
  const emails = chosen.map((f) => f.email);
  let removed = 0;
  for (let i = 0; i < emails.length; i += 200) {
    const { data: rows, error } = await supabaseAdmin.from('follows').delete()
      .ilike('poster_email', escapeLike(poster)).in('follower_email', emails.slice(i, i + 200)).select('id');
    if (error) throw new Error('Could not remove the followers.');
    removed += rows?.length || 0;
  }
  await refreshPosterFollowerCounts(poster);
  return { removed, of: result.followers, percent: pct, emails };
}

const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`; // stop spreadsheets treating the cell as a formula
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(',')).join('\n');
