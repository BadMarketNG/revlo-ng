import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanWanted, WANTED_LIFETIME_MS } from '../src/lib/wanted.mjs';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const request = (changes = {}) => ({
  category: 'for_sale', contact_visibility: 'public', media_type: 'images',
  needed_by: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(), budget_max: '40000',
  ...changes,
});

test('wanted requests close at their deadline and accept an optional budget', () => {
  assert.deepEqual(cleanWanted(request(), NOW), {
    budget_max: 40000,
    needed_by: '2026-10-05T12:00:00.000Z',
    expires_at: '2026-10-05T12:00:00.000Z',
  });
  assert.equal(cleanWanted(request({ category: 'rentals', budget_max: null }), NOW).budget_max, null);
  assert.equal(cleanWanted(request({ category: 'jobs', budget_max: null }), NOW).budget_max, null);
  assert.equal(cleanWanted(request({ budget_max: '40.29' }), NOW).budget_max, 40.29);
});

test('wanted requests require a live, near-term deadline and a reply path', () => {
  assert.ok(cleanWanted(request({ needed_by: new Date(NOW).toISOString() }), NOW).error);
  assert.ok(cleanWanted(request({ needed_by: new Date(NOW + WANTED_LIFETIME_MS + 1).toISOString() }), NOW).error);
  assert.ok(cleanWanted(request({ contact_visibility: 'private' }), NOW).error);
  assert.ok(cleanWanted(request({ category: 'promotions' }), NOW).error);
});

test('wanted requests reject paid promotion, misleading media and invalid budgets', () => {
  assert.ok(cleanWanted(request({ header_url: 'https://example.com/photo.jpg' }), NOW).error);
  assert.ok(cleanWanted(request({ promo_payment_reference: 'paid' }), NOW).error);
  assert.ok(cleanWanted(request({ booking: { modes: ['viewing'] } }), NOW).error);
  assert.ok(cleanWanted(request({ budget_max: -1 }), NOW).error);
  assert.ok(cleanWanted(request({ budget_max: 'abc' }), NOW).error);
});
