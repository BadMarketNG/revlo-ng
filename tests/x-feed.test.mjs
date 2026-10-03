import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, blocksForRun, parseSearch, remainingBudget } from '../src/lib/xFeed.mjs';

test('queries are original posts only, per category and city', () => {
  const q = buildQuery('gadgets', 'Lagos');
  assert.match(q, /"Lagos" -is:retweet -is:reply lang:en$/);
  assert.ok(q.length < 512);
  assert.equal(buildQuery('general', 'Lagos'), null);
  assert.equal(blocksForRun(0).length, blocksForRun(1).length);
  assert.notEqual(blocksForRun(0)[0].key, blocksForRun(1)[0].key);
});

test('results keep the text unedited and the author, as X requires', () => {
  const posts = parseSearch({
    data: [{ id: '1', text: 'iPhone 13 for sale, Ikeja', author_id: 'u1', created_at: '2026-10-03T08:00:00Z', attachments: { media_keys: ['m1'] } }],
    includes: { users: [{ id: 'u1', name: 'Ada', username: 'ada_sells', profile_image_url: 'https://pbs.twimg.com/a.jpg' }], media: [{ media_key: 'm1', type: 'photo', url: 'https://pbs.twimg.com/p.jpg' }] },
  }, { category: 'gadgets', city: 'Lagos' });
  assert.equal(posts[0].text, 'iPhone 13 for sale, Ikeja');
  assert.equal(posts[0].author_username, 'ada_sells');
  assert.equal(posts[0].media_url, 'https://pbs.twimg.com/p.jpg');
});

test('spending caps: the lower of the daily and monthly limits', () => {
  assert.equal(remainingBudget({ todayRead: 0, monthRead: 0 }), 120);           // daily cap 120
  assert.equal(remainingBudget({ todayRead: 100, monthRead: 0 }), 20);
  assert.equal(remainingBudget({ todayRead: 0, monthRead: 3990 }), 10);         // $20 / $0.005 = 4000
  assert.equal(remainingBudget({ todayRead: 0, monthRead: 4000 }), 0);
});
