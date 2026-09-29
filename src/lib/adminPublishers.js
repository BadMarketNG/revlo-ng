import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { publicOrigin } from '@/lib/publicOrigin';
import { normaliseEmail } from '@/lib/revloBlocklist';
import { PUBLISH_LINK_ALLOWANCE, earnedBadge, getFeatureSettings, getPublisherStatus } from '@/lib/revloFeatures';

// Administrator tools (2026-09-29): award or remove any publisher's badge, and
// email any user with the Revlo template. Every badge change emails the user.

export const BADGE_NAMES = Object.freeze({ silver: 'Silver', bronze: 'Bronze', gold: 'Gold' });
const REPLY_TO = 'support@revlo.ng';

export function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function paragraphs(text) {
  return escapeHtml(text).split(/\n{2,}/).map((part) => `<p>${part.replace(/\n/g, '<br>')}</p>`).join('');
}

async function logAdminAction(admin, action, email, detail) {
  await supabaseAdmin.from('admin_log').insert({
    action,
    target_uid: `publisher:${email}`,
    detail: { ...detail, administrator: admin?.email || admin?.sub || null },
  });
}

export async function publisherSummary(email) {
  const cleanEmail = normaliseEmail(email);
  const status = await getPublisherStatus(cleanEmail);
  return {
    email: cleanEmail,
    publishedPosts: status.publishedPosts,
    earnedBadge: status.earnedTrustBadge,
    badgeOverride: status.badgeOverride,
    effectiveBadge: status.trustBadge,
    premiumActive: status.premiumActive,
  };
}

// override: 'silver' | 'bronze' | 'gold' (award), 'none' (remove), null (restore earned)
export async function changePublisherBadge({ email, override, reason, admin }) {
  const cleanEmail = normaliseEmail(email);
  const before = await publisherSummary(cleanEmail);
  const { error } = await supabaseAdmin.from('revlo_publisher_stats').upsert(
    { email: cleanEmail, badge_override: override, updated_at: new Date().toISOString() },
    { onConflict: 'email' },
  );
  if (error) throw new Error('Could not save the badge change.');

  const settings = await getFeatureSettings();
  const effective = earnedBadge(before.publishedPosts, settings, override);
  await supabaseAdmin.from('posts').update({ trust_badge: effective }).ilike('poster_email', cleanEmail.replace(/[\\%_]/g, (c) => `\\${c}`)).is('deleted_at', null);
  await logAdminAction(admin, override === 'none' ? 'badge_remove' : override ? 'badge_award' : 'badge_restore', cleanEmail, { from: before.effectiveBadge, to: effective, reason: reason || null });

  const note = reason ? `<blockquote>${escapeHtml(reason)}</blockquote>` : '';
  const appUrl = `${publicOrigin()}/app.html`;
  let subject;
  let html;
  if (override && override !== 'none') {
    const name = BADGE_NAMES[override];
    subject = `You've been awarded the ${name} badge on Revlo.ng`;
    html = `<p>The Revlo.ng team has awarded you the <strong>${name} badge</strong>. It now appears on all your live and future posts.</p>${note}<p>Your publish links now create up to <strong>${PUBLISH_LINK_ALLOWANCE[override]} posts</strong> each, with no time limit.</p><p><a href="${appUrl}">Open Revlo.ng</a></p>`;
  } else if (override === 'none') {
    subject = 'Your Revlo.ng badge has been removed';
    html = `<p>The Revlo.ng team has removed ${before.effectiveBadge ? `your <strong>${BADGE_NAMES[before.effectiveBadge]} badge</strong>` : 'badges from your account'}. It no longer appears on your posts.</p>${note}<p>Your publish links now create one post each and expire after 30 minutes.</p>`;
  } else {
    subject = 'Your Revlo.ng badge has been updated';
    html = `<p>The Revlo.ng team has returned your account to the badge you have earned from your posts: <strong>${effective ? `${BADGE_NAMES[effective]} badge` : 'no badge yet'}</strong>.</p>${note}<p><a href="${appUrl}">Open Revlo.ng</a></p>`;
  }
  const delivery = await sendEmail({ to: cleanEmail, subject, html: wrapEmail(html), headers: { 'Reply-To': REPLY_TO } });
  return { publisher: await publisherSummary(cleanEmail), emailSent: delivery?.ok === true };
}

export async function sendAdminMessage({ to, subject, message, admin }) {
  const cleanEmail = normaliseEmail(to);
  const delivery = await sendEmail({
    to: cleanEmail,
    subject: `Revlo.ng · ${subject}`,
    html: wrapEmail(paragraphs(message)),
    headers: { 'Reply-To': REPLY_TO },
  });
  await logAdminAction(admin, 'admin_email', cleanEmail, { subject, delivered: delivery?.ok === true });
  return { emailSent: delivery?.ok === true, skipped: Boolean(delivery?.skipped) };
}
