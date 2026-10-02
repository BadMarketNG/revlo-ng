import test from 'node:test';
import assert from 'node:assert/strict';
import { jobPostingFor, nigerianAddress } from '../src/lib/jobPosting.mjs';

const post = { uid: 'ABC234', category: 'jobs', title: 'HR Officer · Softhills Limited', description: 'Softhills Limited is hiring: HR Officer.\n\nFull-time role <b>now</b>.', location: 'Lagos, Lagos State', created_at: '2026-10-02T05:00:00Z', expires_at: '2026-10-03T05:00:00Z', header_url: 'https://revlo.ng/samples/headers/jobs-1.jpg' };

test('job posts get Google JobPosting markup', () => {
  const ld = jobPostingFor(post, { employer: 'Softhills Limited', origin: 'https://revlo.ng' });
  assert.equal(ld['@type'], 'JobPosting');
  assert.equal(ld.title, 'HR Officer');
  assert.equal(ld.hiringOrganization.name, 'Softhills Limited');
  assert.deepEqual(ld.jobLocation.address, { '@type': 'PostalAddress', addressLocality: 'Lagos', addressRegion: 'Lagos State', addressCountry: 'NG' });
  assert.equal(ld.validThrough, post.expires_at);
  assert.deepEqual(ld.employmentType, ['FULL_TIME']);
  assert.match(ld.description, /^<p>Softhills Limited is hiring: HR Officer\.<\/p><p>Full-time role &lt;b&gt;now&lt;\/b&gt;\.<\/p>$/);
  assert.equal(ld.url, 'https://revlo.ng/p/ABC234');
});

test('no job markup without an employer or outside the jobs category', () => {
  assert.equal(jobPostingFor(post, { employer: null, origin: 'x' }), null);
  assert.equal(jobPostingFor({ ...post, category: 'rentals' }, { employer: 'A', origin: 'x' }), null);
});

test('Nigerian addresses', () => {
  assert.deepEqual(nigerianAddress('Abuja FCT'), { '@type': 'PostalAddress', addressLocality: 'Abuja', addressRegion: 'Federal Capital Territory', addressCountry: 'NG' });
  assert.deepEqual(nigerianAddress('Lagos, Nigeria'), { '@type': 'PostalAddress', addressLocality: 'Lagos', addressCountry: 'NG' });
});

test('placeholder employers get no job markup', async () => {
  const { isPlaceholderEmployer } = await import('../src/lib/jobPosting.mjs');
  assert.equal(isPlaceholderEmployer('a Reputable Company'), true);
  assert.equal(isPlaceholderEmployer('Confidential'), true);
  assert.equal(isPlaceholderEmployer('Softhills Limited'), false);
  assert.equal(jobPostingFor(post, { employer: 'a Reputable Company', origin: 'x' }), null);
});
