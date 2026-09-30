import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail, unsubscribeHeader } from '@/lib/email';
import { publicOrigin } from '@/lib/publicOrigin';
import { findActiveBlock, normaliseEmail } from '@/lib/revloBlocklist';
import { signToken, verifyToken } from '@/lib/util';

// Email marketing (2026-09-30). Campaigns written by administrators are sent
// with their own "News & offers" template, so people can tell them apart from
// Revlo's account emails. Every email has a signed unsubscribe link and a
// one-click List-Unsubscribe header. Addresses that unsubscribed, bounced,
// complained or are blocked are skipped.

export const AUDIENCES = Object.freeze({
  publishers: 'Publishers (everyone who has posted)',
  followers: 'Followers (everyone who follows a poster)',
  everyone: 'Everyone (publishers and followers)',
});
export const BATCH_SIZE = 20;
const UNSUBSCRIBE_TTL = 400 * 24 * 60 * 60 * 1000;

const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const storagePrefix = () => `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/`;

// Email clients never run JavaScript, and scripts, frames, forms and event
// handlers are common phishing tools, so they are removed before sending.
// Returns the cleaned HTML and a list of what was removed.
export function sanitiseHtml(html) {
  const removed = new Set();
  let out = String(html || '');
  const strip = (pattern, label, replacement = '') => {
    out = out.replace(pattern, () => { removed.add(label); return replacement; });
  };
  strip(/<script\b[\s\S]*?<\/script\s*>/gi, 'scripts');
  strip(/<script\b[^>]*>/gi, 'scripts');
  strip(/<(iframe|frame|frameset|object|embed|applet)\b[\s\S]*?<\/\1\s*>/gi, 'embedded frames');
  strip(/<(iframe|frame|object|embed|applet|base|meta|link)\b[^>]*>/gi, 'embedded frames or page tags');
  strip(/<form\b[\s\S]*?<\/form\s*>/gi, 'forms');
  strip(/<\/?(form|input|button|textarea|select)\b[^>]*>/gi, 'form fields');
  strip(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, 'click and load handlers');
  strip(/(href|src|action)\s*=\s*("|')\s*(javascript|vbscript|data:text\/html)[^"']*\2/gi, 'javascript: links', '$1="#"');
  return { html: out, removed: [...removed] };
}

// Plain text: paragraphs from blank lines, links made clickable, and a line
// holding only an image address from Revlo storage shown as the image.
export function textToHtml(text) {
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map((block) => {
    const line = block.trim();
    if (!line) return '';
    if (/^https?:\/\/\S+$/.test(line) && line.startsWith(storagePrefix())) {
      return `<p style="margin:0 0 18px;"><img src="${escapeHtml(line)}" alt="" style="display:block;width:100%;max-width:520px;height:auto;border-radius:10px;border:0;"></p>`;
    }
    const withLinks = escapeHtml(line).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#1B5E20;font-weight:700;">${url}</a>`);
    return `<p style="margin:0 0 16px;">${withLinks.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

export function campaignContent(campaign) {
  if (campaign.mode === 'html') return sanitiseHtml(campaign.body);
  return { html: textToHtml(campaign.body), removed: [] };
}

export function unsubscribeUrl(email, campaignId) {
  const token = signToken({ action: 'marketing-unsubscribe', email: normaliseEmail(email), c: campaignId || null }, UNSUBSCRIBE_TTL);
  return `${publicOrigin()}/api/marketing/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function readUnsubscribeToken(token) {
  const claim = verifyToken(token);
  return claim?.action === 'marketing-unsubscribe' && claim.email ? claim : null;
}

// The marketing template: a dark green and gold "News & offers" design,
// deliberately unlike Revlo's white account emails.
export function renderMarketingEmail({ subject, preheader, contentHtml, unsubscribe }) {
  const app = publicOrigin();
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <title>${escapeHtml(subject)}</title>
  <style>
    .rvm-body p { margin: 0 0 16px; }
    .rvm-body img { max-width: 100% !important; height: auto !important; }
    .rvm-body a { color: #1B5E20; font-weight: 700; }
    @media (max-width: 620px) { .rvm-pad { padding-left: 22px !important; padding-right: 22px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4efe1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader || subject).slice(0, 140)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe1;padding:26px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#123d17;border-radius:18px 18px 0 0;padding:22px 30px;" class="rvm-pad">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><a href="${app}/app.html" style="text-decoration:none;color:#ffffff;font-size:24px;font-weight:900;letter-spacing:-0.02em;">revlo<span style="color:#f2b632;">.</span>ng</a></td>
            <td align="right" style="vertical-align:middle;"><span style="display:inline-block;background:#f2b632;color:#123d17;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;">News &amp; offers</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#f2b632;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e6dcc3;border-top:0;border-radius:0 0 18px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td class="rvm-pad" style="padding:30px 40px 4px;">
              <h1 style="margin:0;font-size:25px;line-height:1.25;color:#123d17;letter-spacing:-0.02em;">${escapeHtml(subject)}</h1>
            </td></tr>
            <tr><td class="rvm-pad rvm-body" style="padding:18px 40px 10px;color:#1f2a22;font-size:16px;line-height:1.65;">${contentHtml}</td></tr>
            <tr><td class="rvm-pad" style="padding:6px 40px 30px;">
              <a href="${app}/app.html" style="display:inline-block;background:#1B5E20;color:#ffffff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;">Open Revlo.ng</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 24px 8px;color:#7a735f;font-size:12px;line-height:1.7;">
          <p style="margin:0;">This is a <strong>news and offers</strong> email from Revlo.ng, sent because this address has published or followed on Revlo.</p>
          <p style="margin:8px 0 0;"><a href="${unsubscribe}" style="color:#123d17;font-weight:700;">Unsubscribe from news and offers</a> &middot; <a href="${app}/privacy" style="color:#7a735f;">Privacy</a></p>
          <p style="margin:8px 0 0;">Revlo will never ask for your password, PIN, OTP or BVN.</p>
          <p style="margin:8px 0 0;color:#a39c86;">&copy; ${year} Revlo.ng</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function previewCampaign({ subject, preheader, mode, body }) {
  const { html, removed } = campaignContent({ mode, body });
  return { html: renderMarketingEmail({ subject: subject || 'Your subject', preheader, contentHtml: html, unsubscribe: '#unsubscribe' }), removed };
}

async function distinctEmails(table, column) {
  const emails = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from(table).select(column).range(from, from + 999);
    if (error) throw new Error('Could not build the audience.');
    for (const row of data || []) if (row[column]) emails.add(normaliseEmail(row[column]));
    if (!data || data.length < 1000) break;
  }
  return emails;
}

async function suppressed() {
  const [unsubs, events] = await Promise.all([distinctEmails('revlo_marketing_unsubscribes', 'email'), distinctEmails('revlo_email_events', 'email')]);
  return new Set([...unsubs, ...events]);
}

export async function audienceEmails(audience) {
  const set = new Set();
  if (audience === 'publishers' || audience === 'everyone') {
    for (const e of await distinctEmails('posts', 'poster_email')) set.add(e);
    for (const e of await distinctEmails('revlo_publisher_stats', 'email')) set.add(e);
  }
  if (audience === 'followers' || audience === 'everyone') {
    for (const e of await distinctEmails('follows', 'follower_email')) set.add(e);
  }
  const skip = await suppressed();
  return [...set].filter((email) => email.includes('@') && !skip.has(email));
}

export async function audienceCounts() {
  const entries = await Promise.all(Object.keys(AUDIENCES).map(async (key) => [key, (await audienceEmails(key)).length]));
  return Object.fromEntries(entries);
}

async function sendOne(campaign, content, email) {
  const unsubscribe = unsubscribeUrl(email, campaign.id);
  return sendEmail({
    to: email,
    subject: campaign.subject,
    html: renderMarketingEmail({ subject: campaign.subject, preheader: campaign.preheader, contentHtml: content, unsubscribe }),
    headers: { ...unsubscribeHeader(unsubscribe), 'Reply-To': 'support@revlo.ng' },
  });
}

export async function sendTest(campaign, to) {
  const { html } = campaignContent(campaign);
  return sendOne({ ...campaign, subject: `[Test] ${campaign.subject}` }, html, normaliseEmail(to));
}

// Queues every recipient and marks the campaign as sending.
export async function startCampaign(id) {
  const { data: campaign } = await supabaseAdmin.from('revlo_campaigns').select('*').eq('id', id).maybeSingle();
  if (!campaign) throw new Error('Campaign not found.');
  if (campaign.status !== 'draft') throw new Error('This campaign has already been sent or cancelled.');
  const emails = await audienceEmails(campaign.audience);
  if (!emails.length) throw new Error('Nobody in this audience can receive marketing email.');
  for (let i = 0; i < emails.length; i += 500) {
    const { error } = await supabaseAdmin.from('revlo_campaign_recipients')
      .upsert(emails.slice(i, i + 500).map((email) => ({ campaign_id: id, email })), { onConflict: 'campaign_id,email', ignoreDuplicates: true });
    if (error) throw new Error('Could not queue the recipients.');
  }
  await supabaseAdmin.from('revlo_campaigns').update({ status: 'sending', total: emails.length, started_at: new Date().toISOString() }).eq('id', id);
  return emails.length;
}

// Sends the next batch. The admin page calls this repeatedly until done.
export async function sendNextBatch(id) {
  const { data: campaign } = await supabaseAdmin.from('revlo_campaigns').select('*').eq('id', id).maybeSingle();
  if (!campaign) throw new Error('Campaign not found.');
  if (campaign.status !== 'sending') return { done: true, campaign };
  const { data: batch } = await supabaseAdmin.from('revlo_campaign_recipients').select('email')
    .eq('campaign_id', id).eq('status', 'pending').limit(BATCH_SIZE);
  if (!batch?.length) {
    const { data: finished } = await supabaseAdmin.from('revlo_campaigns').update({ status: 'sent', finished_at: new Date().toISOString() }).eq('id', id).select('*').maybeSingle();
    return { done: true, campaign: finished || campaign };
  }
  // Claim the batch so two open admin pages never send the same email twice.
  const emails = batch.map((row) => row.email);
  const { data: claimed } = await supabaseAdmin.from('revlo_campaign_recipients').update({ status: 'sending' })
    .eq('campaign_id', id).eq('status', 'pending').in('email', emails).select('email');
  const { html } = campaignContent(campaign);
  const skip = await suppressed();
  let sent = 0; let failed = 0; let skipped = 0;
  for (const { email } of claimed || []) {
    let status; let error = null;
    if (skip.has(email) || await findActiveBlock({ email })) { status = 'skipped'; skipped += 1; }
    else {
      const result = await sendOne(campaign, html, email);
      if (result?.ok) { status = 'sent'; sent += 1; }
      else { status = 'failed'; failed += 1; error = String(result?.error || (result?.skipped ? 'email not configured' : 'failed')).slice(0, 300); }
    }
    await supabaseAdmin.from('revlo_campaign_recipients').update({ status, error, sent_at: status === 'sent' ? new Date().toISOString() : null }).eq('campaign_id', id).eq('email', email);
  }
  const { data: updated } = await supabaseAdmin.from('revlo_campaigns')
    .update({ sent: campaign.sent + sent, failed: campaign.failed + failed, skipped: campaign.skipped + skipped })
    .eq('id', id).select('*').maybeSingle();
  return { done: false, campaign: updated || campaign };
}
