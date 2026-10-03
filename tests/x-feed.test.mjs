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
  assert.deepEqual(SHOWN_FOR.promotions, ['promotions']);  // already paid-for posts still show
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

test('X posts become Revlo posts with the text unedited', async () => {
  const { xToPost } = await import('../src/lib/xFeed.mjs');
  const post = xToPost({ id: '99', category: 'for_sale', city: 'Lagos', text: 'Clean iPhone 13 for sale in Lagos\nDM for price', author_name: 'Ada', author_username: 'ada_sells', media_url: 'https://pbs.twimg.com/p.jpg' });
  assert.equal(post.title, 'Clean iPhone 13 for sale in Lagos');
  assert.ok(post.description.startsWith('Clean iPhone 13 for sale in Lagos\nDM for price'));
  assert.equal(post.description, 'Clean iPhone 13 for sale in Lagos\nDM for price');  // credit line removed (owner)
  assert.equal(post.location, 'Lagos, Nigeria');
  assert.equal(post.header_url, 'https://pbs.twimg.com/p.jpg');
  assert.equal(xToPost({ id: '1', category: 'politics', city: 'Nigeria', text: 'Senate passes bill', author_name: 'Premium Times', author_username: 'PremiumTimesng' }).category, 'general');
});

test('X post pictures: first photo as header, second photo or the author picture as icon', async () => {
  const { parseSearch, xToPost } = await import('../src/lib/xFeed.mjs');
  const [two] = parseSearch({ data: [{ id: '5', text: 'Car for sale Lagos', author_id: 'u', attachments: { media_keys: ['a', 'b'] } }], includes: { users: [{ id: 'u', name: 'A', username: 'a', profile_image_url: 'https://pbs.twimg.com/profile_images/1/x_normal.jpg' }], media: [{ media_key: 'a', url: 'https://pbs.twimg.com/media/1.jpg' }, { media_key: 'b', url: 'https://pbs.twimg.com/media/2.jpg' }] } }, { category: 'for_sale', city: 'Lagos' });
  assert.equal(two.media_url, 'https://pbs.twimg.com/media/1.jpg');
  assert.equal(two.icon_url, 'https://pbs.twimg.com/media/2.jpg');
  const [one] = parseSearch({ data: [{ id: '6', text: 'Flat to let Lagos', author_id: 'u' }], includes: { users: [{ id: 'u', name: 'A', username: 'a', profile_image_url: 'https://pbs.twimg.com/profile_images/1/x_normal.jpg' }] } }, { category: 'rentals', city: 'Lagos' });
  assert.equal(one.icon_url, 'https://pbs.twimg.com/profile_images/1/x_400x400.jpg');
  const post = xToPost({ ...two, author_name: 'A', author_username: 'a' });
  assert.equal(post.header_url, 'https://pbs.twimg.com/media/1.jpg');
  assert.equal(post.thumb_url, 'https://pbs.twimg.com/media/2.jpg');
});

test('admin searches: whole-word match words, city check unless national', async () => {
  const { matchesSearch } = await import('../src/lib/xFeed.mjs');
  const rent = { match_words: 'to let, flat, self-contain', national: false };
  assert.equal(matchesSearch({ text: 'Nice flat to let in Lekki, Lagos', city: 'Lagos' }, rent), true);
  assert.equal(matchesSearch({ text: 'Stop flattering yourself, Lagos', city: 'Lagos' }, rent), false);
  assert.equal(matchesSearch({ text: 'Flat to let in Abuja', city: 'Lagos' }, rent), false);
  assert.equal(matchesSearch({ text: 'Cars ₦4m dm', city: 'Lagos' }, { match_words: '₦', national: true }), true);
  assert.equal(matchesSearch({ text: 'anything at all', city: 'Lagos' }, { match_words: '', national: true }), true);
});

test('admin budget: lowest of period, month and run share', async () => {
  const { remainingFor, periodStartFor, searchBlocks } = await import('../src/lib/xFeed.mjs');
  const s = { periodPosts: 120, periodDays: 3, monthlyUsd: 20, pricePerPost: 0.005 };
  assert.equal(remainingFor(s, { periodRead: 0, monthRead: 0 }), 10);              // run share = 120 / 12
  assert.equal(remainingFor(s, { periodRead: 115, monthRead: 115 }), 5);            // period nearly used
  assert.equal(remainingFor(s, { periodRead: 0, monthRead: 3999 }), 1);             // $20 = 4000 posts
  assert.equal(remainingFor({ ...s, periodPosts: 1200 }, { periodRead: 0, monthRead: 0 }), 100);
  assert.equal(periodStartFor(3, Date.UTC(2026, 9, 3, 12)), periodStartFor(3, Date.UTC(2026, 9, 3, 1)));
  const blocks = searchBlocks([{ id: 'a', cities: ['Lagos', 'Abuja'], national: false }, { id: 'b', national: true, cities: ['Nigeria'] }], 0);
  assert.deepEqual(blocks.map(b => b.key), ['a:Lagos', 'a:Abuja', 'b:Nigeria']);
});
