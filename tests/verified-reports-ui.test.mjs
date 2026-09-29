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

test('only one unexpired publish link can be active per email', () => {
  const route = read('src/app/api/magic-link/route.js');
  const audit = read('src/lib/magicLinkAudit.js');
  const migration = read('supabase/migrations/20260929000002_one_active_publish_link.sql');
  assert.match(route, /hasActiveMagicLink\(cleanEmail\)/);
  assert.match(route, /if \(!reserved\) return NextResponse\.json\(\{ ok: true \}\)/);
  assert.match(audit, /reserve_revlo_magic_link/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /redeemed_at is null/);
  assert.match(migration, /expires_at > now\(\)/);
  assert.match(migration, /delivery_status in \('pending', 'sent'\)/);
});

test('repeated create-post openings pause the browser entry point for two hours', () => {
  const guard = read('public/revlo-create-guard.js');
  const html = read('public/app.html');
  assert.ok(html.indexOf('/revlo-create-guard.js') < html.indexOf('/revlo-app.js'));
  assert.match(guard, /const WINDOW_MS = 60 \* 1000/);
  assert.match(guard, /const CREATE_LOCK_MS = 2 \* 60 \* 60 \* 1000/);
  assert.match(guard, /const CREATE_ALLOWED_CLICKS = 5/);
  assert.match(guard, /create \(\?:a \)\?post/);
  assert.match(guard, /document\.cookie/);
  assert.match(guard, /event\.stopImmediatePropagation\(\)/);
  assert.match(guard, /revlo-action-locked/);
});

test('twenty-one rapid controls across post cards pause every post action for 5–10 minutes', () => {
  const guard = read('public/revlo-create-guard.js');
  assert.match(guard, /const POST_ACTION_ALLOWED_CLICKS = 20/);
  assert.match(guard, /POST_ACTION_MIN_LOCK_MINUTES = 5/);
  assert.match(guard, /POST_ACTION_MAX_LOCK_MINUTES = 10/);
  assert.match(guard, /revlo_post_action_clicks_v2/);
  assert.match(guard, /article\[id\^="post-"\]/);
  assert.match(guard, /POST_ACTION_COOKIE/);
  assert.match(guard, /Post actions temporarily paused/);
});

test('five true browser reloads in one minute open a timed caution page', () => {
  const guard = read('public/revlo-refresh-guard.js');
  const cooldown = read('public/revlo-cooldown.js');
  const page = read('public/cooldown.html');
  const html = read('public/app.html');
  assert.ok(html.indexOf('/revlo-refresh-guard.js') < html.indexOf('/revlo-app.js'));
  assert.match(guard, /const REFRESH_LIMIT = 5/);
  assert.match(guard, /navigation\?\.type !== 'reload'/);
  assert.match(guard, /MIN_COOLDOWN_MINUTES = 20/);
  assert.match(guard, /MAX_COOLDOWN_MINUTES = 50/);
  assert.match(guard, /location\.replace\('\/cooldown\.html'\)/);
  assert.match(cooldown, /setInterval\(update, 1000\)/);
  assert.match(cooldown, /location\.replace\('\/app\.html'\)/);
  assert.match(page, /role="timer"/);
});

test('publishers can suppress follow alerts on each new post', () => {
  const route = read('src/app/api/posts/route.js');
  const ui = read('public/revlo-app.js');
  assert.match(route, /if \(data\.followable\) \{/);
  assert.match(route, /notifyFollowers\(cleanEmail, data\)/);
  assert.match(ui, /Existing followers will not be notified about this post/);
});

test('dark mode keeps the logo clear and hides only the visual page scrollbar', () => {
  const theme = read('public/revlo-theme.js');
  assert.match(theme, /img\[alt\^="revlo\.ng"\]/);
  assert.match(theme, /revlo-logo-dark\.png/);
  assert.match(theme, /revloLightLogo/);
  assert.doesNotMatch(theme, /background: #ffffff/);
  assert.match(theme, /scrollbar-width: none/);
  assert.match(theme, /::-webkit-scrollbar/);
});

test('eligible listings receive a private stable discovery order per browser session', () => {
  const route = read('src/app/api/posts/route.js');
  const ordering = read('src/lib/feedOrder.mjs');
  assert.match(route, /request\.cookies\.get\(FEED_SESSION_COOKIE\)/);
  assert.match(route, /const context = `\$\{duration\}:\$\{category \|\| 'all'\}`/);
  assert.match(route, /saltedSessionOrder\(data, feedSeed, context\)/);
  assert.match(route, /httpOnly: true/);
  assert.match(ordering, /createHash\('sha256'\)/);
  assert.match(ordering, /randomBytes\(32\)/);
});

test('administrator-managed categories remain ordered, validated, and salted independently', () => {
  const api = read('src/app/api/categories/route.js');
  const catalogue = read('src/lib/revloCategories.js');
  const posts = read('src/app/api/posts/route.js');
  const publicUi = read('public/revlo-categories.js');
  const adminUi = read('src/app/revlongbm/page.js');
  assert.match(catalogue, /from\('admin_log'\)/);
  assert.match(catalogue, /category_create/);
  assert.match(catalogue, /category_reorder/);
  assert.match(catalogue, /category_delete/);
  assert.match(catalogue, /slug: 'general'.*protected: true/);
  assert.match(api, /getAdminSession\(\)/);
  assert.match(api, /reassigned_to: 'general'/);
  assert.match(api, /body\.order/);
  assert.match(posts, /await isConfiguredCategory\(category\)/);
  assert.match(publicUi, /selectionGeneration/);
  assert.match(publicUi, /revlo-managed-categories/);
  assert.match(adminUi, /\['categories', 'Categories'\]/);
  assert.match(adminUi, /Delete “\$\{category\.label\}”/);
});

test('video posts lead with video and retain the header image as the second slide', () => {
  const carousel = read('public/revlo-video-header.js');
  const html = read('public/app.html');
  assert.ok(html.indexOf('/revlo-video-header.js') < html.indexOf('/revlo-app.js'));
  assert.match(carousel, /post\.media_type === 'video'/);
  assert.match(carousel, /image\.src = post\.header_url/);
  assert.match(carousel, /showingVideo = current === 0/);
  assert.match(carousel, /Choose header media/);
  assert.match(carousel, /Show video/);
  assert.match(carousel, /Show header image/);
  assert.match(carousel, /aria-current/);
});
