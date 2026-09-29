import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('reports require email verification before moderation fields unlock', () => {
  const route = read('src/app/api/report/route.js');
  const ui = read('public/revlo-reporting.js');
  assert.match(route, /action !== 'request_verification'/);
  assert.match(route, /createPendingPublicAction\(\{ action: 'report'/);
  assert.match(route, /getPendingPublicAction\('report', token\)/);
  assert.match(route, /submit_verified_revlo_report/);
  assert.match(ui, /<fieldset disabled>/);
  assert.match(ui, /Verify email to report/);
  assert.match(ui, /name="evidence"/);
  assert.match(ui, /accept="image\/jpeg,image\/png,image\/webp"/);
});

test('report evidence remains private and is exposed only with short-lived admin links', () => {
  const migration = read('supabase/migrations/20260929000001_revlo_verified_reports.sql');
  const admin = read('src/app/api/admin/reports/route.js');
  assert.match(migration, /'report-evidence', 'report-evidence', false/);
  assert.match(migration, /cardinality\(attachments\) <= 2/);
  assert.match(admin, /isAdminRequest\(\)/);
  assert.match(admin, /createSignedUrls\(r\.attachments, 300\)/);
});

test('email links hand verification back to the original Revlo tab with fallback', () => {
  const handoff = read('public/revlo-handoff.js');
  const html = read('public/app.html');
  assert.match(handoff, /BroadcastChannel/);
  assert.match(handoff, /localStorage/);
  assert.match(handoff, /location\.replace\(fallbackUrl\)/);
  assert.ok(html.indexOf('/revlo-handoff.js') < html.indexOf('/revlo-app.js'));
});

test('feed has a persisted two-column desktop view and a one-column mobile fallback', () => {
  const layout = read('public/revlo-layout.js');
  const html = read('public/app.html');
  assert.match(layout, /revlo_feed_layout/);
  assert.match(layout, /Two-column/);
  assert.match(html, /body\.revlo-two-column/);
  assert.match(html, /repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /@media\(max-width:640px\)/);
});

test('publish confirmation describes duration rather than a future go-live date', () => {
  const bundle = read('public/revlo-app.js');
  assert.match(bundle, /Your post is now live for/);
  assert.doesNotMatch(bundle, /Your post is now live in/);
});
