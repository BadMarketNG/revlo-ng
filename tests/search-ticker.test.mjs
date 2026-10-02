import test from 'node:test';
import assert from 'node:assert/strict';
import { ROTATION_MINUTES, buildTicker, normaliseTerm, suggest } from '../src/lib/searchTicker.mjs';

const pool = Array.from({ length: 40 }, (_, i) => ({ term: `term${i}`, score: i < 8 ? 40 - i : 0, newestAt: i >= 30 ? 1_000 + i : 0 }));

test('the ticker mixes the most searched, the newest and a rotating window', () => {
  const { items } = buildTicker(pool, 0);
  assert.deepEqual(items.slice(0, 3).map(i => i.kind), ['popular', 'new', 'rotation']);
  assert.equal(items.filter(i => i.kind === 'popular')[0].term, 'term0');
  assert.equal(items.filter(i => i.kind === 'new')[0].term, 'term39');
  assert.equal(new Set(items.map(i => i.term)).size, items.length);
});

test('every term eventually appears as the rotation advances', () => {
  const seen = new Set();
  for (let w = 0; w < 30; w++) buildTicker(pool, w * ROTATION_MINUTES * 60_000).items.forEach(i => seen.add(i.term));
  assert.equal(seen.size, pool.length);
});

test('small pools are shown in full and say whether real search data exists', () => {
  const { items, hasSearchData } = buildTicker([{ term: 'jobs', score: 0, newestAt: 0 }, { term: 'lagos', score: 0, newestAt: 0 }], 0);
  assert.equal(items.length, 2);
  assert.equal(hasSearchData, false);
});

test('terms are normalised and junk is refused', () => {
  assert.equal(normaliseTerm('  #iPhone  13 '), 'iphone 13');
  assert.equal(normaliseTerm('x'), null);
  assert.equal(normaliseTerm('<script>'), 'script');
  assert.equal(normaliseTerm('a'.repeat(40)), null);
});

test('autocomplete prefers matches at the start, then the most searched', () => {
  const list = suggest([{ term: 'lagos rentals', score: 1 }, { term: 'flats lagos', score: 9 }, { term: 'lagos', score: 5 }, { term: 'lagos jobs', score: 7 }], 'lag');
  assert.deepEqual(list.map(p => p.term), ['lagos jobs', 'lagos', 'lagos rentals', 'flats lagos']);
});
