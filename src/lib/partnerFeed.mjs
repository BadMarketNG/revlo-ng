// Partner feed (2026-10-02): listings and headlines from outside sources, shown as Revlo cards.
// Every item names its source and links to the original; Revlo never presents them as its own
// posts. Sources switch on by themselves when they have content (or when their key is added).
//
//   jobs     BOQQS jobs API (free, no key; terms: credit "via BOQQS", link to the job, drop expired)
//   general  Nigerian news headlines from publishers' public RSS feeds: headline, source and link only
//
//   jobs     Jooble REST API (key in JOOBLE_API_KEY; 500-request allowance, so called at most every 6 hours;
//            links go through Jooble's own job link, as their API intends). The owner treats this source
//            as confidential: Jooble items carry no source name, and cards show none (2026-10-02).
//
// Further sources (Careerjet jobs, affiliate shops, eBay) plug in as more adapters.

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

// The image a publisher attaches to a feed item (media:content, media:thumbnail, an image
// enclosure, or the first <img> in the item). Shown from the publisher's server, never copied.
export function itemImage(block) {
  for (const pattern of [
    /<media:content[^>]*url="([^"]+)"[^>]*(?:medium="image"|type="image)/i,
    /<media:content[^>]*url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i,
    /<media:thumbnail[^>]*url="([^"]+)"/i,
    /<enclosure[^>]*url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/i,
    /<img[^>]*src="([^"]+)"/i,
  ]) {
    const match = block.match(pattern);
    if (match && /^https:\/\//.test(match[1])) {
      // BBC thumbnails come at 240px; their image service serves larger widths on request.
      return match[1].replace(/(ichef\.bbci\.co\.uk\/[^/]+\/[^/]+\/)240\//, '$1480/').replace(/&amp;/g, '&');
    }
  }
  return null;
}

/** The share image a publisher declares for an article page (og:image), used when the feed has none. */
export function ogImage(html) {
  const match = String(html).match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)
    || String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return match && /^https:\/\//.test(match[1]) ? match[1].replace(/&amp;/g, '&') : null;
}

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
      image: itemImage(block),
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

/** Normalises a Jooble job (title, employer, place and salary only; the description is not kept). */
export function fromJooble(job) {
  const url = String(job?.link || '');
  const title = decodeText(job?.title);
  if (!title || !/^https:\/\//.test(url)) return null;
  const updated = Date.parse(job.updated) || null;
  const company = decodeText(job.company);
  return {
    id: `job:${job.id ?? url}`,
    category: 'jobs',
    kind: 'job',
    title: [title, company].filter(Boolean).join(' · ').slice(0, 180),
    source: null, // confidential source: never named on the page
    company: company || null,
    url,
    location: decodeText(job.location) || 'Nigeria',
    salary: decodeText(job.salary) || null,
    publishedAt: updated ? new Date(updated).toISOString() : null,
    expiresAt: null,
  };
}

/** Newest first, one source never filling the whole list, at most `limit` items. */
export function mixSources(items, limit = 60) {
  const bySource = new Map();
  for (const item of [...items].sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))) {
    const group = item.source ?? item.id.split(':')[0];
    if (!bySource.has(group)) bySource.set(group, []);
    bySource.get(group).push(item);
  }
  const queues = [...bySource.values()];
  const out = [];
  while (out.length < limit && queues.some(q => q.length)) for (const q of queues) if (q.length && out.length < limit) out.push(q.shift());
  return out;
}
