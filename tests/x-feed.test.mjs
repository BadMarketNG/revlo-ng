import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery, blocksForRun, parseSearch, remainingBudget } from '../src/lib/xFeed.mjs';

test('queries are original posts only, per category and city', () => {
  const q = buildQuery('for_sale', 'Lagos');
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
  assert.equal(remainingBudget({ todayRead: 0, monthRead: 0 }), 10);            // 120 over 3 days × 4 runs = 10 a run
  assert.equal(remainingBudget({ todayRead: 10, monthRead: 0, runRead: 10 }), 0);
  assert.equal(remainingBudget({ todayRead: 110, monthRead: 0 }), 10);          // daily cap
  assert.equal(remainingBudget({ todayRead: 0, monthRead: 3990 }), 10);         // $20 / $0.005 = 4000
  assert.equal(remainingBudget({ todayRead: 0, monthRead: 4000 }), 0);
});

test('only real listings for the category and city are kept', async () => {
  const { isRelevant } = await import('../src/lib/xFeed.mjs');
  assert.equal(isRelevant({ category: 'promotions', city: 'Lagos', text: 'The Lagos life tweets caught me off guard' }), false);
  assert.equal(isRelevant({ category: 'promotions', city: 'Lagos', text: '20% off all shoes this weekend at our Lagos store' }), true);
  assert.equal(isRelevant({ category: 'gadgets', city: 'Lagos', text: 'Clean iPhone 13 for sale in Lagos, DM' }), true);
  assert.equal(isRelevant({ category: 'gadgets', city: 'Lagos', text: 'My iPhone died in Lagos traffic lol' }), false);
  assert.equal(isRelevant({ category: 'rentals', city: 'Port Harcourt', text: '2 bedroom flat to let, Port Harcourt' }), true);
});

test('focus: jobs, rent, items for sale (per city) and politics (national, news outlets only)', async () => {
  const { buildQuery, blocksForRun, isRelevant, SHOWN_FOR } = await import('../src/lib/xFeed.mjs');
  assert.equal(blocksForRun(0).length, 10);
  const politics = buildQuery('politics', 'Nigeria');
  assert.match(politics, /from:PremiumTimesng/);
  assert.doesNotMatch(politics, /"Nigeria"/);
  assert.equal(isRelevant({ category: 'politics', city: 'Nigeria', text: 'Senate passes the new electoral bill' }), true);
  assert.equal(isRelevant({ category: 'politics', city: 'Nigeria', text: 'Super Eagles win friendly' }), false);
  assert.deepEqual(SHOWN_FOR.vehicles, ['for_sale']);
  assert.equal(SHOWN_FOR.promotions, undefined);
});

test('the budget renews every 3 days', async () => {
  const { periodStart } = await import('../src/lib/xFeed.mjs');
  const a = periodStart(Date.parse('2026-10-03T12:00:00Z'));
  const b = periodStart(Date.parse('2026-10-04T12:00:00Z'));
  const c = periodStart(Date.parse('2026-10-06T12:00:00Z'));
  const days = [a, b, c].map(d => Date.parse(d) / 86400000);
  assert.ok(days.every(d => d % 3 === 0));
  assert.ok(days[2] - days[0] <= 3 && days[2] - days[0] >= 0);
});
