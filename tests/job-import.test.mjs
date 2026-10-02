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
