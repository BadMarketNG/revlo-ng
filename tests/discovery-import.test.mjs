import test from 'node:test';
import assert from 'node:assert/strict';
import { shortletItem, raypropItem } from '../src/lib/discoveryImport.mjs';
import { cleanDatingProfile } from '../src/lib/datingProfile.mjs';
import { cleanDetails } from '../src/lib/listingExtras.mjs';

const now = Date.parse('2026-10-03T10:00:00Z');

test('Dating accepts only adult self-posted, contactable profiles with photo consent', () => {
  const input = { title: 'Ada', description: 'I live in Lagos, love books and cooking, and would like to meet someone kind.', location: 'Lagos, Nigeria', profile: { age: 28, intent: 'relationship', confirmed_adult: true, confirmed_self: true, confirmed_photo: true }, mediaType: 'images', contactVisibility: 'public' };
  assert.deepEqual(cleanDatingProfile(input), { title: 'Ada, 28', description: `Looking for a relationship.\n\n${input.description}`, details: { age: 28, intent: 'relationship' } });
  assert.match(cleanDatingProfile({ ...input, profile: { ...input.profile, age: 17 } }).error, /18 or older/);
  assert.match(cleanDatingProfile({ ...input, profile: { ...input.profile, confirmed_self: false } }).error, /own profile/);
  assert.match(cleanDatingProfile({ ...input, description: `${input.description} DM me on Instagram` }).error, /social handles/);
  assert.match(cleanDatingProfile({ ...input, contactVisibility: 'private' }).error, /Contact/);
  assert.match(cleanDatingProfile({ ...input, mediaType: 'video' }).error, /photo/);
  assert.match(cleanDatingProfile({ ...input, description: `${input.description} Send me money for transport fare` }).error, /money/);
  assert.match(cleanDatingProfile({ ...input, location: '12 Example Street, Lagos' }).error, /exact address/);
  assert.deepEqual(cleanDetails({ age: 28, intent: 'relationship' }, 'dating'), { age: 28, intent: 'relationship' });
  assert.equal(cleanDetails({ age: 17, intent: 'relationship' }, 'dating'), null);
});

test('Lodging imports require Nigerian approved listings and keep at most three photos', () => {
  const raw = { id: '698d89406f2b670830021be3', name: 'Ocean View Apartment', location: { city: 'Lagos', country: 'Nigeria', address: 'Victoria Island' }, amount: 150000, minimumDays: 1, mainImage: 'https://images.shortlet.app/main.jpg', photos: ['https://images.shortlet.app/main.jpg', 'https://images.shortlet.app/two.jpg', 'https://images.shortlet.app/three.jpg', 'https://images.shortlet.app/four.jpg'] };
  const item = shortletItem(raw, now);
  assert.equal(item.category, 'lodging');
  assert.equal(item.photos.length, 3);
  assert.equal(item.location, 'Lagos, Nigeria');
  assert.match(item.description, /Use Contact on Revlo/);
  assert.doesNotMatch(item.description, /https?:\/\//);
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
