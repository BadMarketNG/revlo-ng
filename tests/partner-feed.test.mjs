import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeText, fromBoqqs, mixSources, parseRss } from '../src/lib/partnerFeed.mjs';

const rss = `<rss><channel><item><title><![CDATA[Lagos &amp; Ogun roll out CNG buses]]></title><link>https://example.ng/a</link><description><![CDATA[<p>Full article text that must not be kept</p>]]></description><pubDate>Thu, 01 Oct 2026 10:00:00 +0100</pubDate></item><item><title>No link item</title></item><item><title>Insecure</title><link>http://example.ng/b</link></item></channel></rss>`;

test('RSS keeps only the headline, source and https link', () => {
  const items = parseRss(rss, 'Example');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Lagos & Ogun roll out CNG buses');
  assert.equal(items[0].source, 'Example');
  assert.equal(items[0].url, 'https://example.ng/a');
  assert.ok(!('description' in items[0]) && !JSON.stringify(items[0]).includes('Full article'));
});

test('BOQQS jobs keep their link and are dropped once expired', () => {
  assert.equal(fromBoqqs({ id: 'BQ-1', title: 'Barista', employer: 'Cafe', url: 'https://boqqs.com/jobs/x', expiresAt: '2000-01-01T00:00:00Z' }), null);
  const job = fromBoqqs({ id: 'BQ-2', title: 'Barista', employer: 'Cafe', url: 'https://boqqs.com/jobs/y', location: { city: 'Lagos', country: 'NG' }, expiresAt: '2999-01-01T00:00:00Z' });
  assert.equal(job.source, 'BOQQS');
  assert.equal(job.url, 'https://boqqs.com/jobs/y');
  assert.equal(job.location, 'Lagos, Nigeria');
});

test('one source never fills the whole list', () => {
  const items = [...Array.from({ length: 10 }, (_, i) => ({ source: 'A', publishedAt: `2026-10-0${(i % 9) + 1}T00:00:00Z` })), { source: 'B', publishedAt: '2026-01-01T00:00:00Z' }];
  const mixed = mixSources(items, 4);
  assert.ok(mixed.some(i => i.source === 'B'));
});

test('entities and tags are decoded', () => {
  assert.equal(decodeText('Tinubu&#8217;s <b>plan</b> &amp; more'), 'Tinubu’s plan & more');
});

test('feed images are found and BBC thumbnails are enlarged', async () => {
  const { itemImage, ogImage } = await import('../src/lib/partnerFeed.mjs');
  assert.equal(itemImage('<item><media:thumbnail width="240" url="https://ichef.bbci.co.uk/ace/ws/240/cpsprodpb/a.jpg"/></item>'), 'https://ichef.bbci.co.uk/ace/ws/480/cpsprodpb/a.jpg');
  assert.equal(itemImage('<item><description><![CDATA[<img src="https://cdn.example.ng/a.jpg">]]></description></item>'), 'https://cdn.example.ng/a.jpg');
  assert.equal(itemImage('<item><img src="http://insecure.ng/a.jpg"></item>'), null);
  assert.equal(ogImage('<meta property="og:image" content="https://punchng.com/x.jpg" />'), 'https://punchng.com/x.jpg');
});

test('Jooble jobs are normalised without their description', async () => {
  const { fromJooble } = await import('../src/lib/partnerFeed.mjs');
  const job = fromJooble({ id: 7, title: '<b>Sales</b> Officer', company: 'Acme &amp; Co', location: 'Lagos', salary: '', snippet: 'long text', link: 'https://jooble.org/desc/7', updated: '2026-10-01T09:00:00' });
  assert.equal(job.title, 'Sales Officer · Acme & Co');
  assert.equal(job.source, null);
  assert.equal(job.company, 'Acme & Co');
  assert.equal(JSON.stringify(job).toLowerCase().includes('jooble.org/desc') && !/jooble(?!\.org)/i.test(JSON.stringify(job)), true);
  assert.equal(job.location, 'Lagos');
  assert.equal(job.salary, null);
  assert.equal('snippet' in job, false);
  assert.equal(fromJooble({ title: 'x', link: 'http://insecure' }), null);
});
