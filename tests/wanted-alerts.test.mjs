import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanAlert, describeAlert, matches } from '../src/lib/alerts.mjs';

test('alerts separate Wanted requests from existing offers', () => {
  const offer = cleanAlert({ email: 'seller@example.com', category: 'for_sale' }).value;
  const wanted = cleanAlert({ email: 'seller@example.com', post_type: 'wanted', category: 'for_sale' }).value;
  const post = { category: 'for_sale', location: 'Ikeja, Lagos', title: 'Used fridge', description: '' };
  assert.equal(offer.post_type, 'offer');
  assert.equal(matches(offer, { ...post, post_type: 'wanted' }), false);
  assert.equal(matches(wanted, { ...post, post_type: 'wanted' }), true);
  assert.equal(matches(wanted, { ...post, post_type: 'offer' }), false);
  assert.match(describeAlert(wanted), /new For Sale requests/);
});
