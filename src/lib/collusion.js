import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { refreshPosterFollowerCounts } from '@/lib/followerCounts';

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
//
//   z = -4 + 3.0D + 2.5I + 1.5C + 1.5B + 1.5S + 1.0V + 1.0Q + 0.5A
//   score = 100 / (1 + e^-z)     >= 80 likely fabricated, 50-79 review, < 50 low
//
// A genuine poster typically scores under 10; one person following themselves
// from their own device and network scores above 95.

export const WEIGHTS = Object.freeze({ D: 3.0, I: 2.5, C: 1.5, B: 1.5, S: 1.5, V: 1.0, Q: 1.0, A: 0.5 });
export const BIAS = -4;
export const MIN_FOLLOWERS = 3;
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
    supabaseAdmin.from('follows').select('poster_email,follower_email,created_at').limit(50000),
    supabaseAdmin.from('posts').select('poster_email,created_at,source_ip').limit(50000),
    supabaseAdmin.from('revlo_activity_signals').select('kind,actor_email,subject_email,ip,device_id,created_at').limit(100000),
  ]);
  for (const result of [follows, posts, signals]) if (result.error) throw new Error('Collusion data is unavailable.');
  return { follows: follows.data || [], posts: posts.data || [], signals: signals.data || [] };
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
    return {
      email,
      followedAt: row.created_at,
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

  const times = followRows.map((r) => Date.parse(r.created_at)).filter(Number.isFinite).sort((a, b) => a - b);
  const burstCount = times.filter((t, i) => (i > 0 && t - times[i - 1] <= BURST_MS) || (i < times.length - 1 && times[i + 1] - t <= BURST_MS)).length;
  const gaps = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);

  const s = n > 0 ? {
    D: followers.filter((f) => f.deviceMatch).length / n,
    I: followers.filter((f) => f.ipMatch).length / n,
    C: Math.max(concentration(followers.map((f) => f.primaryIp), n), concentration(followers.map((f) => f.primaryDevice), n)),
    B: burstCount / n,
    S: followers.filter((f) => f.singlePurpose).length / n,
    V: 1 - Math.exp(-(n / Math.max(1, ageDays)) / 3),
    Q: 1 - Math.exp(-(n / Math.max(1, postCount)) / 5),
    A: Math.exp(-ageDays / 14),
  } : { D: 0, I: 0, C: 0, B: 0, S: 0, V: 0, Q: 0, A: 0 };
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
  };
}

// Every poster with at least MIN_FOLLOWERS followers, highest score first.
export async function collusionReport() {
  const data = await loadData();
  const index = buildIndex(data);
  return [...index.followsByPoster.keys()]
    .filter((poster) => index.followsByPoster.get(poster).length >= MIN_FOLLOWERS)
    .map((poster) => { const { followerDetails, ...row } = analyse(poster, data, index); return row; })
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
  return { ...result, ipGroups };
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

const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`; // stop spreadsheets treating the cell as a formula
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
export const toCsv = (rows) => rows.map((row) => row.map(csvCell).join(',')).join('\n');
