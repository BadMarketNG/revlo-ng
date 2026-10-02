// Partner feed (2026-10-02): listings and headlines from outside sources, shown as Revlo cards.
// Every item names its source and links to the original; Revlo never presents them as its own
// posts. Sources switch on by themselves when they have content (or when their key is added).
//
//   jobs     BOQQS jobs API (free, no key; terms: credit "via BOQQS", link to the job, drop expired)
//   general  Nigerian news headlines from publishers' public RSS feeds: headline, source and link only
//
// Further sources (Jooble/Careerjet jobs, affiliate shops, eBay) plug in as more adapters.

export const USER_AGENT = 'Revlo.ng partner listings (https://revlo.ng; support@revlo.ng)';

export const NEWS_FEEDS = [
  { name: 'Punch', url: 'https://punchng.com/feed/' },
  { name: 'Premium Times', url: 'https://www.premiumtimesng.com/feed' },
  { name: 'BBC News Pidgin', url: 'https://feeds.bbci.co.uk/pidgin/rss.xml' },
  { name: 'Vanguard', url: 'https://www.vanguardngr.com/feed/' },
  { name: 'Channels TV', url: 'https://www.channelstv.com/feed/' },
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#8217': '’', '#8216': '‘', '#8220': '“', '#8221': '”', '#8211': '–', '#8212': '—', '#038': '&', '#039': "'" };
export function decodeText(value) {
  return String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (match, name) => ENTITIES[name] ?? (name[0] === '#' ? String.fromCodePoint(Number(name.slice(1)) || 32) : match))
    .replace(/\s+/g, ' ')
    .trim();
}

const tag = (block, name) => {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeText(match[1]) : '';
};

/** Parses RSS 2.0 into headline items (no article text is kept). */
export function parseRss(xml, sourceName) {
  const items = [];
  for (const block of String(xml).match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []) {
    const title = tag(block, 'title');
    const url = tag(block, 'link') || (block.match(/<guid[^>]*>(https?:[^<]+)<\/guid>/i)?.[1] ?? '');
    const published = Date.parse(tag(block, 'pubDate')) || null;
    if (!title || !/^https:\/\//.test(url)) continue;
    items.push({
      id: `news:${sourceName}:${url}`,
      category: 'general',
      kind: 'news',
      title: title.slice(0, 180),
      source: sourceName,
      url,
      location: 'Nigeria',
      publishedAt: published ? new Date(published).toISOString() : null,
      expiresAt: null,
    });
  }
  return items;
}

/** Normalises a BOQQS job (only vacancies BOQQS may relicense are ever returned by its API). */
export function fromBoqqs(job) {
  if (!job?.id || !job?.url) return null;
  if (job.expiresAt && Date.parse(job.expiresAt) <= Date.now()) return null;
  const place = [job.location?.city, job.location?.country === 'NG' ? 'Nigeria' : job.location?.country].filter(Boolean).join(', ');
  return {
    id: `boqqs:${job.id}`,
    category: 'jobs',
    kind: 'job',
    title: [job.title, job.employer].filter(Boolean).join(' · ').slice(0, 180),
    source: 'BOQQS',
    url: job.url,
    location: place || null,
    salary: job.salary?.display || null,
    publishedAt: job.postedAt || null,
    expiresAt: job.expiresAt || null,
  };
}

/** Newest first, one source never filling the whole list, at most `limit` items. */
export function mixSources(items, limit = 60) {
  const bySource = new Map();
  for (const item of [...items].sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))) {
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source).push(item);
  }
  const queues = [...bySource.values()];
  const out = [];
  while (out.length < limit && queues.some(q => q.length)) for (const q of queues) if (q.length && out.length < limit) out.push(q.shift());
  return out;
}
