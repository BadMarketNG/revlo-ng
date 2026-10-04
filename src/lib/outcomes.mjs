// Results (2026-10-02): wording and timing for "Gone in 3 hours on Revlo".

export const OUTCOMES = {
  rentals: { outcome: 'let', verb: 'Let' },
  for_sale: { outcome: 'sold', verb: 'Sold' },
  jobs: { outcome: 'filled', verb: 'Filled' },
};
export const outcomeFor = (category, postType = 'offer') => postType === 'wanted'
  ? { outcome: 'found', verb: 'Found' }
  : OUTCOMES[category] || { outcome: 'done', verb: 'Done' };
export const VERBS = { let: 'Let', sold: 'Sold', filled: 'Filled', done: 'Done', found: 'Found' };

/** "under an hour", "3 hours", "2 days" (rounded down, so the claim is never flattering). */
export function duration(hours) {
  if (!(hours >= 0)) return null;
  if (hours < 1) return 'under an hour';
  if (hours < 48) { const h = Math.floor(hours); return `${h} hour${h === 1 ? '' : 's'}`; }
  const d = Math.floor(hours / 24);
  return `${d} days`;
}

/** A short, non-personal label for the card: the post title (trimmed) and the city. */
export function resultLabel(post) {
  const title = String(post.title || '').split(' · ')[0].replace(/\s+/g, ' ').trim();
  const short = title.length > 60 ? `${title.slice(0, 57).replace(/\s+\S*$/, '')}…` : title;
  const city = String(post.location || '').split(',')[0].trim();
  return city && !short.toLowerCase().includes(city.toLowerCase()) ? `${short} · ${city}` : short;
}

export const headline = (outcome, hours) => `${VERBS[outcome] || 'Done'} in ${duration(hours)}`;
