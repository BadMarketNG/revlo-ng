import test from 'node:test';
import assert from 'node:assert/strict';
import { eventFor, parseEvent, parsePrice, productFor } from '../src/lib/listingMarkup.mjs';

const base = { uid: 'XYZ234', header_url: 'https://revlo.ng/h.jpg', thumb_url: 'https://revlo.ng/t.jpg', expires_at: '2026-10-03T10:00:00Z', location: 'Lagos, Nigeria' };

test('For Sale posts with a price get Product markup', () => {
  const ld = productFor({ ...base, category: 'for_sale', title: 'Green sofa', description: 'Comfy.\n\nPrice: ₦85,000 · Used' }, { origin: 'https://revlo.ng' });
  assert.equal(ld['@type'], 'Product');
  assert.equal(ld.offers.price, '85000.00');
  assert.equal(ld.offers.priceCurrency, 'NGN');
  assert.equal(ld.offers.itemCondition, 'https://schema.org/UsedCondition');
  assert.equal(productFor({ ...base, category: 'for_sale', title: 'Sofa', description: 'Make an offer' }, { origin: 'x' }), null);
  assert.equal(parsePrice('Selling for ₦1,250,000 or near offer'), 1250000);
});

test('Promotions with an event block get Event markup in Lagos time', () => {
  const desc = 'Live music night.\n\nWhen: Sat 12 Oct 2026, 7:00 pm – 11:30 pm\nWhere: Freedom Park, Lagos Island';
  assert.deepEqual(parseEvent(desc), { start: '2026-10-12T19:00:00+01:00', end: '2026-10-12T23:30:00+01:00', venue: 'Freedom Park, Lagos Island' });
  const ld = eventFor({ ...base, category: 'promotions', title: 'Acoustic evening', description: desc }, { origin: 'https://revlo.ng', organizer: 'Yaba Sounds', address: { '@type': 'PostalAddress', addressLocality: 'Lagos', addressCountry: 'NG' } });
  assert.equal(ld['@type'], 'Event');
  assert.equal(ld.location.name, 'Freedom Park, Lagos Island');
  assert.equal(ld.organizer.name, 'Yaba Sounds');
  assert.equal(eventFor({ ...base, category: 'promotions', title: 'Sale', description: 'No date' }, { origin: 'x', address: {} }), null);
});
