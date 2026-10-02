import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanAlert, describeAlert, matches } from '../src/lib/alerts.mjs';

test('alert requests are cleaned', () => {
  assert.ok(cleanAlert({ email: 'bad' }).error);
  assert.deepEqual(cleanAlert({ email: ' A@B.ng ', category: 'rentals', area: 'Lagos', keyword: '<b>self con</b>' }).value, { email: 'a@b.ng', category: 'rentals', area: 'Lagos', keyword: 'b self con b' });
  assert.deepEqual(cleanAlert({ email: 'a@b.ng', category: 'hack', area: 'Mars' }).value, { email: 'a@b.ng', category: 'all', area: 'all', keyword: null });
});

test('alerts match category, area and every keyword word', () => {
  const alert = { category: 'rentals', area: 'Lagos', keyword: 'self contained' };
  assert.equal(matches(alert, { category: 'rentals', location: 'Lagos, Nigeria', title: 'Self contained room in Yaba', description: '' }), true);
  assert.equal(matches(alert, { category: 'rentals', location: 'Abuja FCT', title: 'Self contained', description: '' }), false);
  assert.equal(matches(alert, { category: 'jobs', location: 'Lagos', title: 'Self contained', description: '' }), false);
  assert.equal(matches({ category: 'all', area: 'Abuja', keyword: null }, { category: 'jobs', location: 'Abuja FCT', title: 'x' }), true);
  assert.equal(describeAlert(alert), 'new Rentals posts mentioning “self contained” in Lagos');
});
