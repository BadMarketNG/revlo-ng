import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, detectLocation, splitPost, telegramToPost } from '../src/lib/telegramImport.mjs';

test('categories, places and titles from channel posts', () => {
  assert.equal(classify('We are hiring a sales rep in Ikeja. Send your CV to …'), 'jobs');
  assert.equal(classify('Self con to let in Yaba, ₦600k per annum'), 'rentals');
  assert.equal(classify('iPhone 13, UK used, ₦450,000 negotiable'), 'for_sale');
  assert.equal(classify('20% off all shoes this weekend only'), 'promotions');
  assert.equal(classify('Good morning family', 'general'), 'general');
  assert.equal(detectLocation('Mini flat in Gwarinpa'), 'Abuja FCT');
  assert.equal(detectLocation('No place mentioned', 'Lagos, Nigeria'), 'Lagos, Nigeria');
  const { title, description } = splitPost('🔥🔥 *2 bedroom flat to let* 🔥\nLekki Phase 1\nRent: ₦3.5m/yr');
  assert.equal(title, '2 bedroom flat to let 🔥');
  assert.match(description, /^Lekki Phase 1\nRent: ₦3\.5m\/yr$/);
});

test('channel credit follows the channel settings', () => {
  const msg = { text: 'Driver needed urgently\nApply via the link. Lagos.' };
  const withCredit = telegramToPost(msg, { credit: true, username: 'lagosjobs', default_category: 'general', default_area: 'Nigeria' });
  assert.equal(withCredit.category, 'jobs');
  assert.match(withCredit.description, /Shared from Telegram: @lagosjobs$/);
  const without = telegramToPost(msg, { credit: false, username: 'lagosjobs', default_category: 'general', default_area: 'Nigeria' });
  assert.doesNotMatch(without.description, /Telegram/);
  assert.equal(telegramToPost({ text: '👍' }, { credit: false }), null);
});
