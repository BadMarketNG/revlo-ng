// Curated short-stay listings. No guest data, payments or booking credentials
// are copied into Revlo posts.
import { decodeText } from './partnerFeed.mjs';
import { stripPostLinks } from './postLinks.mjs';

export const DISCOVERY_POSTER = 'support@revlo.ng';
const NIGERIAN_CITIES = new Set(['lagos', 'abuja', 'port harcourt', 'ibadan', 'kano', 'enugu', 'kaduna', 'benin city', 'abeokuta', 'owerri', 'uyo', 'warri', 'jos', 'ilorin']);
const safeText = (value, max = 200) => stripPostLinks(decodeText(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ')).slice(0, max);
const safeSourceUrl = (value, hosts) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.includes(url.hostname.toLowerCase()) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
};
const safePhoto = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname) && url.toString().length <= 500 ? url.toString() : null;
  } catch { return null; }
};
const photosOf = (values) => [...new Set(values.map(safePhoto).filter(Boolean))].slice(0, 3);
const hasContact = text => /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|\+?234[\s.-]?[789]\d|\b0[789]\d{9}\b|\b(?:whatsapp|telegram|dm me|chat me)\b)/i.test(text);

export function shortletItem(raw, now = Date.now()) {
  const id = String(raw?.id || '');
  const city = safeText(raw?.location?.city, 60);
  const country = safeText(raw?.location?.country, 30).toLowerCase();
  const title = safeText(raw?.name, 160);
  const amount = Number(raw?.amount);
  if (!/^[a-f\d]{24}$/i.test(id) || !title || !NIGERIAN_CITIES.has(city.toLowerCase()) || !['nigeria', 'ng'].includes(country) || !Number.isFinite(amount) || amount <= 0 || hasContact(title)) return null;
  if (raw.minimumDays != null && (!Number.isInteger(Number(raw.minimumDays)) || Number(raw.minimumDays) > 30)) return null;
  const url = `https://shortlet.app/listings/${id}/`;
  const photos = photosOf([raw.mainImage, ...(Array.isArray(raw.photos) ? raw.photos : [])]);
  if (!photos.length) return null;
  const area = safeText(raw?.location?.address, 70);
  return {
    source: 'shortlet', externalId: `${id}:${new Date(now).toISOString().slice(0, 10)}`, sourceUrl: url, duration: 'now',
    title, category: 'lodging', location: `${city}, Nigeria`, photos,
    description: `${area ? `${area}, ${city}. ` : ''}Listed from ₦${Math.round(amount).toLocaleString('en-NG')} per night on Shortlet. Use Contact on Revlo to ask about dates, price and booking terms. Do not pay a deposit before confirming the stay.`,
  };
}

export function raypropItem(raw, now = Date.now()) {
  const id = String(raw?.unique_listing_id || raw?.id || '');
  const city = safeText(raw?.city, 60);
  const title = safeText(raw?.title, 160);
  const url = safeSourceUrl(raw?.listing_url || raw?.public_url || raw?.url, ['rayprop.io', 'www.rayprop.io']);
  const kobo = Number(raw?.nightly_kobo);
  const naira = Number(raw?.price_per_night);
  const price = Number.isFinite(kobo) && kobo > 0 ? Math.round(kobo / 100) : naira;
  if (!/^[a-z0-9_-]{5,80}$/i.test(id) || !title || !NIGERIAN_CITIES.has(city.toLowerCase()) || !url || raw?.is_verified !== true || raw?.available !== true || (raw?.currency && raw.currency !== 'NGN') || !Number.isFinite(price) || price <= 0 || hasContact(title)) return null;
  const photos = photosOf((Array.isArray(raw?.listing_images) ? raw.listing_images : []).map(image => image?.image_url || image));
  if (!photos.length) return null;
  return {
    source: 'rayprop', externalId: `${id}:${new Date(now).toISOString().slice(0, 10)}`, sourceUrl: url, duration: 'now',
    title, category: 'lodging', location: `${city}, Nigeria`, photos,
    description: `${safeText(raw?.neighborhood, 70) || city}, ${city}. Listed from ₦${Math.round(price).toLocaleString('en-NG')} per night on RayProp. Use Contact on Revlo to ask about dates, price and booking terms. Do not pay a deposit before confirming the stay.`,
  };
}
