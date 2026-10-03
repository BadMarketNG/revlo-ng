import test from 'node:test';
import assert from 'node:assert/strict';
import { DATING_FEEDS, datingItem, shortletItem, raypropItem } from '../src/lib/discoveryImport.mjs';

const now = Date.parse('2026-10-03T10:00:00Z');

test('Dating imports only recent articles from the two approved Nigerian publishers', () => {
  const story = { title: 'Love Life: We Met in Lagos', url: 'https://www.zikoko.com/ships/love-life-we-met/', publishedAt: '2026-10-01T08:00:00Z' };
  const item = datingItem(story, DATING_FEEDS[0], now);
  assert.equal(item.category, 'dating');
  assert.equal(item.sourceUrl, story.url);
  assert.match(item.description, /not a personal dating profile/);
  assert.equal(datingItem({ ...story, url: 'https://evil.example/ships/love-life-we-met/' }, DATING_FEEDS[0], now), null);
  assert.equal(datingItem({ ...story, publishedAt: '2026-07-01T08:00:00Z' }, DATING_FEEDS[0], now), null);
  assert.equal(datingItem({ ...story, title: 'Teen Love Life: My first date' }, DATING_FEEDS[0], now), null);
  assert.equal(datingItem({ ...story, title: 'Love Life: Call me on +2348012345678' }, DATING_FEEDS[0], now), null);
  const singles = datingItem({ title: 'A Prayer for the Spouse You Haven’t Met Yet', url: 'https://kissesandhuggs.org/prayer-for-a-spouse/', publishedAt: '2026-10-03T06:00:00Z' }, DATING_FEEDS[1], now);
  assert.equal(singles?.source, 'kisses-and-huggs');
});

test('Lodging imports require Nigerian approved listings and keep at most three photos', () => {
  const raw = { id: '698d89406f2b670830021be3', name: 'Ocean View Apartment', location: { city: 'Lagos', country: 'Nigeria', address: 'Victoria Island' }, amount: 150000, minimumDays: 1, mainImage: 'https://images.shortlet.app/main.jpg', photos: ['https://images.shortlet.app/main.jpg', 'https://images.shortlet.app/two.jpg', 'https://images.shortlet.app/three.jpg', 'https://images.shortlet.app/four.jpg'] };
  const item = shortletItem(raw, now);
  assert.equal(item.category, 'lodging');
  assert.equal(item.photos.length, 3);
  assert.equal(item.location, 'Lagos, Nigeria');
  assert.match(item.description, /Book and pay only on the provider/);
  assert.equal(shortletItem({ ...raw, location: { city: 'Accra', country: 'Ghana' } }, now), null);
  assert.equal(shortletItem({ ...raw, minimumDays: 90 }, now), null);
  assert.equal(shortletItem({ ...raw, name: 'Call +2348012345678 for a room' }, now), null);
});

test('RayProp listings fail closed without verification, availability and an official URL', () => {
  const raw = { unique_listing_id: 'rp_lst_8f21c4', title: '2-bed apartment', city: 'Abuja', neighborhood: 'Wuse', nightly_kobo: 12500000, currency: 'NGN', is_verified: true, available: true, listing_url: 'https://rayprop.io/stays/rp_lst_8f21c4', listing_images: [{ image_url: 'https://images.rayprop.io/one.jpg' }] };
  assert.equal(raypropItem(raw, now)?.location, 'Abuja, Nigeria');
  assert.equal(raypropItem({ ...raw, is_verified: false }, now), null);
  assert.equal(raypropItem({ ...raw, available: false }, now), null);
  assert.equal(raypropItem({ ...raw, listing_url: 'https://other.example/stays/1' }, now), null);
});
