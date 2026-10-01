import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { normaliseEmail } from '@/lib/revloBlocklist';
import { publicOrigin } from '@/lib/publicOrigin';

// Revlo moderation (2026-10-01): contact-detail detection in posts,
// publisher suspensions, search-tag limits and follower-contact limits.

// ---------- Contact details in posts ----------
// Posts must not carry phone numbers, emails, links or social handles; people
// reach each other through Revlo's verified contact. Detection flags a post
// for admin review rather than blocking it, because numbers like prices and
// sizes can look similar.
const DETECTORS = [
  ['email address', /[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Z0-9.-]+\s*(?:\.|\(dot\)|\[dot\])\s*[A-Z]{2,}/gi],
  ['phone number', /(?:\+?234|\b0)[\s.-]?[789][01]\d(?:[\s.-]?\d){7}\b/g],
  ['phone number', /\+\d{1,3}[\s.-]?\d(?:[\s.-]?\d){7,12}\b/g],
  ['phone number', /\b\d(?:[\s.-]?\d){9,13}\b/g],
  ['link', /\b(?:https?:\/\/|www\.)\S+/gi],
  ['link', /\b[a-z0-9-]{2,}\.(?:com|ng|net|org|io|co|me|info|biz|app|link|store|shop)(?:\/\S*)?\b/gi],
  ['WhatsApp or Telegram', /\b(?:whats\s?app|wa\.me|watsapp|telegram|t\.me)\b/gi],
  ['social handle', /(?:^|\s)@[A-Za-z0-9_.]{3,30}\b/g],
  ['call or text request', /\b(?:call|text|dm|chat|reach|contact)\s+(?:me\s+)?(?:on|via|at)\s+\S+/gi],
];

export function detectContactInfo(...texts) {
  const text = texts.filter(Boolean).join('\n');
  const found = [];
  for (const [kind, pattern] of DETECTORS) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0].trim();
      if (!found.some((f) => f.value === value)) found.push({ kind, value: value.slice(0, 80) });
      if (found.length >= 10) return found;
    }
  }
  return found;
}

export async function flagPostForContactInfo(post) {
  const matches = detectContactInfo(post.title, post.description, post.location, (post.tags || []).join(' '));
  if (!matches.length) return null;
  await supabaseAdmin.from('revlo_post_flags').upsert(
    { post_uid: post.uid, poster_email: normaliseEmail(post.poster_email), reason: 'contact_details', matches, status: 'pending' },
    { onConflict: 'post_uid,reason', ignoreDuplicates: true },
  );
  return matches;
}

// ---------- Suspensions ----------
export async function activeSuspension(email) {
  const clean = normaliseEmail(email);
  if (!clean) return null;
  const { data } = await supabaseAdmin.from('revlo_suspensions').select('id,until,reason')
    .eq('email', clean).is('lifted_at', null).gt('until', new Date().toISOString())
    .order('until', { ascending: false }).limit(1);
  return data?.[0] || null;
}

export function suspendedResponse(suspension, action = 'do this') {
  const until = new Date(suspension.until);
  return NextResponse.json({
    error: `This email is suspended on Revlo until ${until.toUTCString()}, so you cannot ${action}.`,
    suspended_until: suspension.until,
  }, { status: 403 });
}

// Returns a 403 response when the email is suspended, else null.
export async function requireNotSuspended(email, action) {
  const suspension = await activeSuspension(email);
  return suspension ? suspendedResponse(suspension, action) : null;
}

export async function suspendEmail({ email, days, reason, admin }) {
  const clean = normaliseEmail(email);
  const until = new Date(Date.now() + days * 86400000).toISOString();
  const { data, error } = await supabaseAdmin.from('revlo_suspensions')
    .insert({ email: clean, until, reason: reason || null, created_by: admin?.email || admin?.sub || null })
    .select('*').single();
  if (error) throw new Error('Could not save the suspension.');
  const note = reason ? `<blockquote>${String(reason).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</blockquote>` : '';
  const delivery = await sendEmail({
    to: clean,
    subject: 'Your Revlo.ng account has been suspended',
    html: wrapEmail(`<p>Your email address has been <strong>suspended on Revlo.ng for ${days} ${days === 1 ? 'day' : 'days'}</strong>, until <strong>${new Date(until).toUTCString()}</strong>.</p>${note}<p>While suspended you cannot publish new posts, follow publishers or contact your followers. Your suspension ends automatically.</p><p>If you believe this is a mistake, reply to this email.</p><p><a href="${publicOrigin()}/rules">Read the Revlo rules</a></p>`),
    headers: { 'Reply-To': 'support@revlo.ng' },
  });
  await supabaseAdmin.from('admin_log').insert({ action: 'publisher_suspended', target_uid: `publisher:${clean}`, detail: { days, until, reason: reason || null, email_sent: delivery?.ok === true, administrator: admin?.email || admin?.sub || null } });
  return { suspension: data, emailSent: delivery?.ok === true };
}

export async function liftSuspension({ email, admin }) {
  const clean = normaliseEmail(email);
  const { data } = await supabaseAdmin.from('revlo_suspensions')
    .update({ lifted_at: new Date().toISOString(), lifted_by: admin?.email || admin?.sub || null })
    .eq('email', clean).is('lifted_at', null).gt('until', new Date().toISOString()).select('id');
  await supabaseAdmin.from('admin_log').insert({ action: 'publisher_suspension_lifted', target_uid: `publisher:${clean}`, detail: { administrator: admin?.email || admin?.sub || null } });
  return data?.length || 0;
}

// ---------- Search tags ----------
export function tagLimit({ badge, promoted }, settings) {
  if (promoted) return settings.tags_promoted;
  if (badge === 'gold') return settings.tags_gold;
  if (badge === 'silver') return settings.tags_silver;
  if (badge === 'bronze') return settings.tags_bronze;
  return settings.tags_normal;
}

// Tags: letters, numbers and dashes, 2-24 characters, lower case, no repeats.
export function cleanTags(input) {
  if (input == null) return { value: [] };
  if (!Array.isArray(input)) return { error: 'Tags must be a list.' };
  const out = [];
  for (const raw of input) {
    const tag = String(raw || '').trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
    if (!tag) continue;
    if (!/^[\p{L}\p{N}][\p{L}\p{N}-]{1,23}$/u.test(tag)) return { error: `"${raw}" is not a valid tag. Use 2 to 24 letters, numbers or dashes.` };
    if (!out.includes(tag)) out.push(tag);
  }
  return { value: out };
}

// ---------- Contacting followers ----------
// Normal publishers: admin-set number of followers per post. Bronze: half of
// the contactable followers. Silver, Gold, Premium (paid) or promoted posts: all.
export function followerContactLimit({ badge, paid }, contactable, settings) {
  if (paid || badge === 'silver' || badge === 'gold') return contactable;
  if (badge === 'bronze') return Math.ceil(contactable / 2);
  return Math.min(contactable, settings.normal_follower_contacts);
}
