import { createHash, randomBytes } from 'node:crypto';

export const FEED_SESSION_COOKIE = 'revlo_feed_session';

export function isFeedSessionSeed(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export function createFeedSessionSeed() {
  return randomBytes(32).toString('hex');
}

function discoveryScore(seed, context, uid) {
  return createHash('sha256')
    .update(seed)
    .update('\0')
    .update(context)
    .update('\0')
    .update(String(uid || ''))
    .digest('hex');
}

export function saltedSessionOrder(posts, seed, context) {
  if (!Array.isArray(posts) || posts.length < 2) return Array.isArray(posts) ? [...posts] : [];
  return posts
    .map((post, index) => ({
      post,
      index,
      score: discoveryScore(seed, context, post?.uid),
    }))
    .sort((left, right) => left.score.localeCompare(right.score)
      || String(left.post?.uid || '').localeCompare(String(right.post?.uid || ''))
      || left.index - right.index)
    .map(({ post }) => post);
}
