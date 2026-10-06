import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_HOMEPAGE_COPY, normalizeHomepageCopy } from '../src/lib/homepageCopy.mjs';

test('homepage copy preserves every structured slot and cleans text', () => {
  const copy = normalizeHomepageCopy({
    heroLine1: '  Find   something today. ',
    urgentPrompts: ['One?', '', 'Three?', 'Four?'],
    benefitViewings: 'Book online',
  });
  assert.equal(copy.heroLine1, 'Find something today.');
  assert.deepEqual(copy.urgentPrompts, ['One?', DEFAULT_HOMEPAGE_COPY.urgentPrompts[1], 'Three?', 'Four?']);
  assert.equal(copy.benefitViewings, 'Book online');
  assert.equal(copy.heroLine2, DEFAULT_HOMEPAGE_COPY.heroLine2);
});

test('homepage copy applies field limits', () => {
  const copy = normalizeHomepageCopy({ heroLine1: 'x'.repeat(200), heroDescription: 'y'.repeat(500) });
  assert.equal(copy.heroLine1.length, 90);
  assert.equal(copy.heroDescription.length, 320);
});
