// Small, source-specific collectors for publicly visible Nigerian listing pages.
// Source URLs stay in revlo_discovery_imports; no outside link enters public post copy.
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { stripPostLinks } from './postLinks.mjs';
import { revloLocation } from './jobImport.mjs';

const CITIES = ['Lagos', 'Abuja', 'Port Harcourt'];
const HOME_TYPES = /\b(flat|apartment|room|duplex|house|bungalow|studio|terrace|self.contain|short.?let)\b/i;
const CONTACT = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?234[\s.-]?[789]\d|\b0[789]\d{9}\b)/gi;
const clean = (value, max = 1000) => stripPostLinks(String(value || '').replace(CONTACT, '').replace(/\s+/g, ' ')).slice(0, max).trim();
const ageDays = (date, now) => (now - date.getTime()) / 86400000;
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 32);

function recentDay(day, month, now) {
  const current = new Date(now);
  let date = new Date(`${day} ${month} ${current.getUTCFullYear()} 12:00:00 GMT`);
  if (date.getTime() > now + 86400000) date = new Date(`${day} ${month} ${current.getUTCFullYear() - 1} 12:00:00 GMT`);
  return Number.isFinite(date.getTime()) && ageDays(date, now) >= -1 && ageDays(date, now) <= 4;
}

export function myJobMagItems(html, city, now = Date.now()) {
  if (!CITIES.includes(city)) return [];
  const $ = load(html);
  return $('.job-list-li').map((_, element) => {
    const row = $(element);
    const anchor = row.find('h2 a[href^="/job/"]').first();
    const path = anchor.attr('href');
    const title = clean(anchor.text(), 160);
    const summary = clean(row.find('.job-desc').first().text(), 600);
    const dateText = row.find('#job-date').first().clone().children().remove().end().text().trim();
    const match = dateText.match(/\b(\d{1,2})\s+([A-Za-z]+)\b/);
    const location = row.find('#job-date a[href^="/jobs-location/"]').first().text().trim();
    const locatedHere = city === 'Port Harcourt'
      ? /\bPort[ -]Harcourt\b/i.test(`${title} ${summary}`)
      : new RegExp(city.replace(' ', '[ -]'), 'i').test(location);
    if (!path || !title || summary.length < 35 || !match || !recentDay(match[1], match[2], now) || !locatedHere) return null;
    const sourceUrl = new URL(path, 'https://www.myjobmag.com').toString();
    if (new URL(sourceUrl).hostname !== 'www.myjobmag.com') return null;
    return {
      source: 'myjobmag', externalId: digest(sourceUrl), sourceUrl, category: 'jobs', city,
      title, location: revloLocation(city),
      description: `${summary}\n\nPublished on MyJobMag. Use Contact to ask Revlo for the application details.`,
      image: null,
    };
  }).get().filter(Boolean);
}

export function propertyCentreItems(html, city, now = Date.now()) {
  if (!CITIES.includes(city)) return [];
  const $ = load(html);
  return $('[data-listing-card="desktop"]').map((_, element) => {
    const row = $(element);
    const title = clean(row.find('h3').first().text(), 160);
    const path = row.find('a[href^="/for-rent/"][aria-label]').last().attr('href');
    const sourceUrl = path ? new URL(path, 'https://nigeriapropertycentre.com').toString() : null;
    const picture = row.find('img[src^="https://images.nigeriapropertycentre.com/"]').first().attr('src');
    const area = clean(row.find('span.truncate').first().text(), 90);
    const price = clean(row.find('.tabular-nums').first().text(), 60);
    const excerpt = clean(row.find('p.text-foreground-muted').first().text(), 650);
    const age = row.text().match(/Added\s+(today|yesterday|\d+\s+days?\s+ago)/i)?.[1]?.toLowerCase();
    const days = age === 'today' ? 0 : age === 'yesterday' ? 1 : Number.parseInt(age, 10);
    if (!title || !HOME_TYPES.test(title) || !sourceUrl || !picture || !Number.isFinite(days) || days > 3 || !new RegExp(city.replace(' ', '[ -]'), 'i').test(area)) return null;
    if (new URL(sourceUrl).hostname !== 'nigeriapropertycentre.com') return null;
    return {
      source: 'nigeriapropertycentre', externalId: digest(sourceUrl), sourceUrl, category: 'rentals', city,
      title: `${title} · ${area}`.slice(0, 200), location: revloLocation(city),
      description: `${area}. ${price ? `Advertised rent ${price}. ` : ''}${excerpt}\n\nListed on Nigeria Property Centre. Use Contact to ask Revlo about the listing and latest availability.`.slice(0, 5000),
      image: picture,
    };
  }).get().filter(Boolean);
}

// The public Facebook Page embed contains JSON props for its timeline. Parse the
// JSON rather than executing scripts or depending on CSS class names.
export function facebookEmbedProps(html) {
  const marker = '"timelinePosts":[';
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const propsAt = html.lastIndexOf('"props":{', at);
  if (propsAt < 0) return null;
  const start = html.indexOf('{', propsAt);
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) {
      try {
        const props = JSON.parse(html.slice(start, i + 1));
        return Array.isArray(props.timelinePosts) && props.pageID ? props : null;
      } catch { return null; }
    }
  }
  return null;
}

export function facebookListingItems(html, now = Date.now()) {
  const props = facebookEmbedProps(html);
  if (!props) return [];
  return props.timelinePosts.map(post => {
    const message = String(post.message || '');
    const city = CITIES.find(name => new RegExp(`\\b${name}\\b`, 'i').test(message));
    const category = /\b(hiring|vacancy|vacancies|recruiting|job opening)\b/i.test(message) ? 'jobs'
      : /\b(to let|for rent|short.?let|room available|apartment for rent)\b/i.test(message) ? 'rentals'
        : /\b(for sale|selling)\b/i.test(message) ? 'for_sale' : null;
    const published = Number(post.createdTime) * 1000;
    const title = clean(message.split(/\n+/)[0], 150);
    const body = clean(message, 1300);
    const image = post.photoURL;
    if (!city || !category || !title || body.length < 50 || !image || !/^https:\/\/scontent[^/]*\.fbcdn\.net\//i.test(image) || !Number.isFinite(published) || published > now + 3600000 || now - published > 2 * 86400000) return null;
    if (category === 'rentals' && !HOME_TYPES.test(body)) return null;
    if (category === 'jobs' && (message.match(/https?:\/\//g) || []).length > 2) return null;
    const sourceUrl = props.pageURL?.split('?')[0];
    if (!sourceUrl || !/^https:\/\/www\.facebook\.com\/[\w.\/-]+$/.test(sourceUrl)) return null;
    return {
      source: 'facebook', externalId: digest(`${props.pageID}:${published}:${message}`), sourceUrl,
      category, city, title, location: revloLocation(city), image,
      description: `${body}\n\nFrom a public post by ${clean(props.pageName, 80)}. Use Contact to ask Revlo for the original post and current details.`.slice(0, 5000),
    };
  }).filter(Boolean);
}

export function facebookEmbedUrl(pageUrl) {
  try {
    const url = new URL(pageUrl);
    if (url.protocol !== 'https:' || !['www.facebook.com', 'facebook.com'].includes(url.hostname) || !/^\/[\w.\/-]+\/?$/.test(url.pathname) || url.search || url.hash) return null;
    const embed = new URL('https://www.facebook.com/plugins/page.php');
    embed.search = new URLSearchParams({ href: url.toString(), tabs: 'timeline', width: '500', height: '800', small_header: 'true', adapt_container_width: 'true', hide_cover: 'false', show_facepile: 'false' }).toString();
    return embed.toString();
  } catch { return null; }
}
