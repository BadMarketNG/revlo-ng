import test from 'node:test';
import assert from 'node:assert/strict';
import { jobToPost, JOB_POSTER } from '../src/lib/jobImport.mjs';

test('imported jobs become Revlo job posts without the source or an outside link', () => {
  const post = jobToPost({ id: 'job:1', title: 'HR Officer · Softhills Limited', company: 'Softhills Limited', location: 'Lagos, Lagos State', salary: '₦200,000', summary: 'Recruitment and onboarding.', url: 'https://jooble.org/desc/1' });
  assert.equal(JOB_POSTER, 'support@revlo.ng');
  assert.equal(post.title, 'HR Officer · Softhills Limited');
  assert.equal(post.category, 'jobs');
  assert.match(post.header_url, /^https:\/\/revlo\.ng\/samples\/headers\/jobs-[1-5]\.jpg$/);
  assert.match(post.thumb_url, /^https:\/\/revlo\.ng\/samples\/icons\/icon-\d\d\.jpg$/);
  assert.notEqual(post.header_url, post.thumb_url);
  assert.deepEqual(post.tags, ['jobs', 'lagos']);
  assert.match(post.description, /Use Contact on this post/);
  assert.doesNotMatch(JSON.stringify(post), /jooble|https?:\/\/(?!revlo\.ng)/i);
});

test('imported jobs use Revlo place names so the location filter finds them', async () => {
  const { revloLocation, jobToPost } = await import('../src/lib/jobImport.mjs');
  assert.equal(revloLocation('Lagos, Lagos State'), 'Lagos, Nigeria');
  assert.equal(revloLocation('Abuja'), 'Abuja FCT');
  assert.equal(revloLocation('Port Harcourt, Rivers State'), 'Port Harcourt, Rivers');
  assert.equal(revloLocation('Owerri'), 'Owerri');
  assert.equal(jobToPost({ id: 'x', title: 'Driver', company: 'A Ltd', location: 'Lagos, Lagos State', url: 'https://jooble.org/x' }).location, 'Lagos, Nigeria');
});

test('new support jobs cannot let Abuja or Port Harcourt overtake Lagos', async () => {
  const { canImportJobForCity, priorityJobCity } = await import('../src/lib/jobImport.mjs');
  assert.equal(priorityJobCity('Lagos, Lagos State'), 'Lagos');
  assert.equal(priorityJobCity('Abuja FCT'), 'Abuja');
  assert.equal(priorityJobCity('Port Harcourt, Rivers'), 'Port Harcourt');
  assert.equal(priorityJobCity('Kano, Kano State'), null);
  const counts = { Lagos: 9, Abuja: 6, 'Port Harcourt': 3 };
  assert.equal(canImportJobForCity('Lagos', counts), true);
  assert.equal(canImportJobForCity('Abuja', counts), false);
  assert.equal(canImportJobForCity('Port Harcourt', counts), false);
  counts.Lagos += 3;
  assert.equal(canImportJobForCity('Abuja', counts), true);
  assert.equal(canImportJobForCity('Port Harcourt', counts), true);
});
