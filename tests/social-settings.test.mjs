import test from 'node:test';
import assert from 'node:assert/strict';
import { hashtagSuffix, normalizeFeedDescription, normalizeHashtags, normalizeSocialSettings, platformIsDue } from '../src/lib/socialSettings.mjs';

test('normalizes unique safe hashtags and applies limits', () => {
  assert.deepEqual(normalizeHashtags('#RevloNG, Lagos-Jobs #RevloNG work!'), ['RevloNG', 'LagosJobs', 'work']);
  assert.equal(hashtagSuffix(['RevloNG', '#Lagos']), '#RevloNG #Lagos');
});

test('normalizes saved social settings', () => {
  const settings = normalizeSocialSettings({ x_enabled: false, facebook_enabled: true, categories: ['jobs'], interval_hours: 6, hashtags: ['#Jobs'], feed_description: '  Fresh   opportunities today  ', last_x_at: '2026-10-06T00:00:00Z' });
  assert.equal(settings.xEnabled, false);
  assert.equal(settings.intervalHours, 6);
  assert.deepEqual(settings.categories, ['jobs']);
  assert.deepEqual(settings.hashtags, ['Jobs']);
  assert.equal(settings.feedDescription, 'Fresh opportunities today');
  assert.equal(normalizeFeedDescription('x'.repeat(300)).length, 240);
});

test('checks interval from each platform last-send timestamp', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  assert.equal(platformIsDue(null, 24, now), true);
  assert.equal(platformIsDue('2026-10-06T07:00:00Z', 6, now), false);
  assert.equal(platformIsDue('2026-10-06T05:59:59Z', 6, now), true);
});
