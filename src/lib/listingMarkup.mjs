// Google markup for For Sale and Promotions posts (2026-10-02).
// - For Sale: schema.org Product with an Offer (price in naira, condition) when the post states a price.
// - Promotions: schema.org Event when the post has an event date (Google's event search).
// public/revlo-listing-details.js adds optional fields to the post form and writes them at the end of
// the description ("Price: ₦85,000 · Used", "When: Sat 12 Oct 2026, 7:00 pm – 11:00 pm",
// "Where: …"), so everything in the markup is visible on the post page, as Google requires.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** A naira price from the post text: the "Price:" line first, else the first ₦ amount. */
export function parsePrice(text) {
  const s = String(text || '');
  const match = s.match(/^Price:\s*(?:₦|NGN|N)\s?([\d,]+(?:\.\d{1,2})?)/im) || s.match(/(?:₦|NGN\s?)([\d,]{3,}(?:\.\d{1,2})?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 && value < 1e10 ? value : null;
}

export function parseCondition(text) {
  const line = String(text || '').match(/^Price:.*$/im)?.[0] || String(text || '');
  if (/\brefurbished\b/i.test(line)) return 'https://schema.org/RefurbishedCondition';
  if (/\b(used|fairly used|pre-owned|second[- ]hand|tokunbo)\b/i.test(line)) return 'https://schema.org/UsedCondition';
  if (/\bbrand new\b|\bnew\b/i.test(line)) return 'https://schema.org/NewCondition';
  return null;
}

// "7:00 pm" -> [19, 0]
function clock(text) {
  const m = String(text).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') h += 12;
  return [h, Number(m[2] || 0)];
}
const pad = n => String(n).padStart(2, '0');
// Nigeria is UTC+1 all year (no daylight saving).
const lagosIso = (y, mo, d, [h, mi]) => `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}:00+01:00`;

/** The event block written by the form: "When: Sat 12 Oct 2026, 7:00 pm – 11:00 pm" and "Where: …". */
export function parseEvent(text) {
  const s = String(text || '');
  const when = s.match(/^When:\s*(?:[A-Za-z]{3},?\s+)?(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4}),\s*(\d{1,2}(?::\d{2})?\s*[ap]m)(?:\s*[–-]\s*(\d{1,2}(?::\d{2})?\s*[ap]m))?/im);
  const where = s.match(/^Where:\s*(.{2,160})$/im)?.[1]?.trim();
  if (!when || !where) return null;
  const month = MONTHS[when[2].toLowerCase()];
  const start = clock(when[4]);
  if (month == null || !start) return null;
  const end = when[5] ? clock(when[5]) : null;
  const [d, y] = [Number(when[1]), Number(when[3])];
  return { start: lagosIso(y, month, d, start), end: end ? lagosIso(y, month, d, end) : null, venue: where };
}

const firstLine = text => String(text || '').split(/\n/)[0].slice(0, 300);
const plain = text => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 1000);

export function productFor(post, { origin }) {
  if (!post || post.category !== 'for_sale') return null;
  const price = parsePrice(post.description) ?? parsePrice(post.title);
  if (!price) return null;
  const condition = parseCondition(post.description);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: String(post.title).slice(0, 150),
    description: plain(post.description) || undefined,
    ...(post.header_url ? { image: [post.header_url, post.thumb_url].filter(Boolean) } : {}),
    offers: {
      '@type': 'Offer',
      url: `${origin}/p/${post.uid}`,
      price: price.toFixed(2),
      priceCurrency: 'NGN',
      availability: 'https://schema.org/InStock',
      ...(condition ? { itemCondition: condition } : {}),
      ...(post.expires_at ? { priceValidUntil: post.expires_at.slice(0, 10) } : {}),
      areaServed: { '@type': 'Country', name: 'Nigeria' },
    },
  };
}

export function eventFor(post, { origin, organizer, address }) {
  if (!post || post.category !== 'promotions') return null;
  const event = parseEvent(post.description);
  if (!event) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: String(post.title).slice(0, 150),
    description: firstLine(post.description) || undefined,
    startDate: event.start,
    ...(event.end ? { endDate: event.end } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: event.venue, address: { ...address, streetAddress: event.venue } },
    ...(post.header_url ? { image: [post.header_url] } : {}),
    ...(organizer ? { organizer: { '@type': 'Organization', name: organizer, url: `${origin}/p/${post.uid}` } } : {}),
    url: `${origin}/p/${post.uid}`,
  };
}
