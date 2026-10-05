import assert from 'node:assert/strict';
import test from 'node:test';
import { facebookEmbedUrl, facebookListingItems, myJobMagItems, propertyCentreItems } from '../src/lib/publicPageScrape.mjs';

const now = Date.UTC(2026, 9, 5, 12);

test('job collector keeps fresh jobs in the requested city and removes contact routes', () => {
  const row = (date, place, title, summary) => `<div class="job-list-li"><h2><a href="/job/${title}">${title}</a></h2><li class="job-desc">${summary}</li><li id="job-date">${date}<span><a href="/jobs-location/${place}">${place}</a></span></li></div>`;
  const html = row('04 October', 'Lagos', 'Store Manager', 'Manage a busy Lagos store. Apply at https://example.com or send mail to jobs@example.com for more details.')
    + row('20 September', 'Lagos', 'Old Role', 'Manage a busy Lagos store and report to the owner every day.')
    + row('04 October', 'Abuja', 'Wrong City', 'Manage a busy Abuja store and report to the owner every day.');
  const items = myJobMagItems(html, 'Lagos', now);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Store Manager');
  assert.match(items[0].description, /Published on MyJobMag/);
  assert.doesNotMatch(items[0].description, /example\.com|@/);
});

test('Port Harcourt jobs need an explicit city mention, even on the Rivers page', () => {
  const row = summary => `<div class="job-list-li"><h2><a href="/job/role">Sales Manager</a></h2><li class="job-desc">${summary}</li><li id="job-date">03 October<span><a href="/jobs-location/rivers">Rivers</a></span></li></div>`;
  assert.equal(myJobMagItems(row('Travel across Rivers State and manage a field sales team.'), 'Port Harcourt', now).length, 0);
  assert.equal(myJobMagItems(row('Manage field sales across Port Harcourt and surrounding communities.'), 'Port Harcourt', now).length, 1);
});

test('property collector requires a fresh rental, real source image and matching city', () => {
  const row = (age, city, photo) => `<div data-listing-card="desktop"><h3>2 Bedroom Flat</h3><a aria-label="See listing" href="/for-rent/lagos/ikeja/123">See listing</a><img src="${photo}"><span class="truncate">Ikeja, ${city}</span><span class="tabular-nums">₦1,000,000</span><p class="text-foreground-muted">A well-kept flat with separate living space and secure parking.</p><span>Added ${age}</span></div>`;
  const photo = 'https://images.nigeriapropertycentre.com/properties/images/thumbs/123/flat.webp';
  const items = propertyCentreItems(row('today', 'Lagos', photo) + row('6 days ago', 'Lagos', photo) + row('today', 'Abuja', photo) + row('today', 'Lagos', ''), 'Lagos', now);
  assert.equal(items.length, 1);
  assert.equal(items[0].image, photo);
});

test('Facebook embed collector takes only fresh, located listings with a real post photo', () => {
  const post = { message: 'Lagos apartment for rent in Ikeja. Two bedrooms and secure parking, available this week.', createdTime: Math.floor((now - 3600000) / 1000), photoURL: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/example.jpg' };
  const wrap = posts => `<script>window.__data={"props":{"pageID":"123","pageURL":"https://www.facebook.com/example","pageName":"Example Properties","timelinePosts":${JSON.stringify(posts)}}};</script>`;
  const items = facebookListingItems(wrap([post, { ...post, message: 'A general company update for everyone in Lagos today.' }, { ...post, createdTime: post.createdTime - 10 * 86400 }]), now);
  assert.equal(items.length, 1);
  assert.equal(items[0].category, 'rentals');
  assert.equal(facebookEmbedUrl('http://www.facebook.com/example'), null);
});
