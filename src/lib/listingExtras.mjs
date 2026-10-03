// Listing extras (2026-10-02): booking availability and structured details, saved when a post is
// created (from optional fields added by public/revlo-listing-details.js).
import { cleanBookingSettings } from './bookings.mjs';

const num = (v, max) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null; };
const pick = (v, allowed) => (allowed.includes(v) ? v : null);

/** Structured details for filters and card badges; only known fields are kept. */
export function cleanDetails(input, category) {
  if (!input || typeof input !== 'object') return null;
  let details = null;
  if (category === 'rentals') {
    details = {
      rent: num(input.rent, 1e10),
      rent_period: pick(input.rent_period, ['year', 'month', 'night']),
      property: pick(input.property, ['room', 'self_contain', '1_bed', '2_bed', '3_bed', '4_bed', 'shop', 'office']),
      bathrooms: num(input.bathrooms, 20),
      furnishing: pick(input.furnishing, ['furnished', 'unfurnished', 'serviced']),
    };
  } else if (category === 'for_sale') {
    details = { price: num(input.price, 1e10), condition: pick(input.condition, ['Brand new', 'Used', 'Refurbished']) };
  } else if (category === 'dating') {
    details = { age: num(input.age, 99), intent: pick(input.intent, ['dating', 'relationship', 'marriage']) };
    if (!Number.isInteger(details.age) || details.age < 18 || !details.intent) return null;
  }
  if (!details) return null;
  details = Object.fromEntries(Object.entries(details).filter(([, v]) => v != null));
  if (details.rent && !details.rent_period) details.rent_period = 'year';
  return Object.keys(details).length ? details : null;
}

export async function saveListingExtras(db, { uid, category }, body) {
  const booking = cleanBookingSettings(body?.booking, category);
  const details = cleanDetails(body?.details, category);
  const writes = [];
  if (booking) writes.push(db.from('revlo_booking_settings').insert({ post_uid: uid, ...booking }));
  if (details) writes.push(db.from('revlo_post_details').insert({ post_uid: uid, details }));
  for (const result of await Promise.all(writes)) if (result.error) console.error('[listing-extras]', result.error.code || result.error.message);
}
