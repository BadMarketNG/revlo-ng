// Search ticker formula (2026-10-02). Pure functions so they can be tested without a database.
//
// The ticker interleaves three groups so every term eventually appears:
//   popular   highest decayed search score (half-life 72 hours)
//   newest    terms most recently used on a live post
//   rotation  everything else, in a stable order, shown a window at a time; the window
//             advances every ROTATION_MINUTES, so the whole pool cycles through.

export const ROTATION_MINUTES = 20;
export const GROUP_SIZE = 6;
const HALF_LIFE_MS = 72 * 3600 * 1000;

// Starter terms keep the ticker useful before many posts carry tags. Generic searches, not claims.
// Words that appear in post text (the feed searches text, not category names; the category buttons cover those).
export const STARTER_TERMS = ['phone', 'sofa', 'flat', 'room', 'books', 'car', 'shop', 'assistant', 'lunch', 'repair', 'music', 'studio', 'lagos', 'abuja', 'ibadan', 'port harcourt', 'enugu', 'kaduna', 'benin'];

export function normaliseTerm(value) {
  const term = String(value ?? '').toLowerCase().replace(/^#+/, '').replace(/[^\p{L}\p{N}&' -]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return term.length >= 2 && term.length <= 32 ? term : null;
}

export function decayedScore(score, scoreAt, now = Date.now()) {
  if (!score) return 0;
  const age = Math.max(0, now - new Date(scoreAt).getTime());
  return score * 0.5 ** (age / HALF_LIFE_MS);
}

// Stable pseudo-random order so the rotation is fair without favouring alphabetical terms.
function stableHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

/**
 * @param {{ term: string, score: number, newestAt: number }[]} pool  score: decayed searches; newestAt: ms of the newest post using it (0 if none)
 * @returns {{ items: { term: string, kind: 'popular'|'new'|'rotation' }[], hasSearchData: boolean }}
 */
export function buildTicker(pool, now = Date.now(), groupSize = GROUP_SIZE) {
  const unique = [...new Map(pool.filter(p => p && p.term).map(p => [p.term, p])).values()];
  const hasSearchData = unique.some(p => p.score >= 1);
  const taken = new Set();
  const take = (list, kind) => list.filter(p => !taken.has(p.term)).slice(0, groupSize).map(p => { taken.add(p.term); return { term: p.term, kind }; });

  const popular = take([...unique].filter(p => p.score > 0).sort((a, b) => b.score - a.score), 'popular');
  const newest = take([...unique].filter(p => p.newestAt > 0).sort((a, b) => b.newestAt - a.newestAt), 'new');
  const rest = unique.filter(p => !taken.has(p.term)).sort((a, b) => stableHash(a.term) - stableHash(b.term));
  let rotation = [];
  if (rest.length) {
    const windowIndex = Math.floor(now / (ROTATION_MINUTES * 60_000));
    // The rotation also fills any slots the popular and newest groups could not, so a young
    // feed (little search data, few tagged posts) still shows a full ticker.
    const size = Math.min(rest.length, groupSize * 3 - popular.length - newest.length);
    const start = (windowIndex * size) % rest.length;
    rotation = Array.from({ length: size }, (_, i) => rest[(start + i) % rest.length]).map(p => ({ term: p.term, kind: 'rotation' }));
  }
  // Interleave: popular, new, rotation, popular, new, rotation …
  const items = [];
  const longest = Math.max(popular.length, newest.length, rotation.length);
  for (let i = 0; i < longest; i++) for (const group of [popular, newest, rotation]) if (group[i]) items.push(group[i]);
  return { items, hasSearchData };
}

/** Autocomplete: terms that start with the query first, then terms containing it; most searched first. */
export function suggest(pool, query, limit = 6) {
  const q = normaliseTerm(query);
  if (!q) return [];
  const starts = [], contains = [];
  for (const p of pool) {
    if (p.term === q) continue;
    if (p.term.startsWith(q)) starts.push(p); else if (p.term.includes(q)) contains.push(p);
  }
  const byScore = (a, b) => b.score - a.score || a.term.localeCompare(b.term);
  return [...starts.sort(byScore), ...contains.sort(byScore)].slice(0, limit);
}
