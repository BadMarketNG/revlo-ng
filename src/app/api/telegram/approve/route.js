// Telegram partner channels (2026-10-02): Revlo approves a channel and sets how its posts appear.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyToken } from '@/lib/util';
import { esc, page } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';
const CATEGORIES = [['general', 'Detect from each post (General if unclear)'], ['jobs', 'Jobs'], ['rentals', 'Rentals'], ['for_sale', 'For Sale'], ['promotions', 'Promotions']];
const AREAS = ['Nigeria', 'Lagos, Nigeria', 'Abuja FCT', 'Port Harcourt, Rivers', 'Ibadan, Oyo State', 'Kano, Kano State', 'Enugu, Enugu State', 'Kaduna, Kaduna State', 'Benin City, Edo State'];

async function load(token) {
  const claim = verifyToken(token);
  if (!claim || claim.action !== 'tg-approve') return null;
  const { data } = await supabaseAdmin.from('revlo_telegram_channels').select('*').eq('chat_id', claim.chat).maybeSingle();
  return data;
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const channel = await load(token);
  if (!channel) return page('Telegram channel', '<h1>Link not valid</h1><p>This approval link has expired or is not valid.</p>');
  const select = (name, options, value) => `<select name="${name}" style="width:100%;padding:10px;border-radius:10px;border:1.5px solid #d6d6d6;font:15px system-ui">${options.map(([v, t]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const field = (label, html) => `<label style="display:grid;gap:4px;font:700 13px system-ui;margin:10px 0">${label}${html}</label>`;
  return page('Approve Telegram channel', `<h1>${esc(channel.title || channel.username || 'Telegram channel')}</h1>
    <p>${channel.username ? `<a href="https://t.me/${esc(channel.username)}">@${esc(channel.username)}</a> · ` : ''}Status: <strong>${esc(channel.status)}</strong></p>
    <p>Only approve if the channel owner has agreed to share their posts on Revlo.</p>
    <form method="post"><input type="hidden" name="token" value="${esc(token)}">
      ${field('Category', select('category', CATEGORIES, channel.default_category))}
      ${field('Area when a post does not name a city', select('area', AREAS.map(a => [a, a]), channel.default_area))}
      ${field('How long posts stay up', select('duration', [['now', '24 hours'], ['1m', '1 month']], channel.duration))}
      ${field('Credit line on each post', select('credit', [['yes', 'Show "Shared from Telegram: @channel"'], ['no', 'No credit (source not shown)']], channel.credit ? 'yes' : 'no'))}
      ${field('Credit name (optional)', `<input name="credit_name" value="${esc(channel.credit_name || '')}" placeholder="${esc(channel.username ? `@${channel.username}` : channel.title || '')}" style="padding:10px;border-radius:10px;border:1.5px solid #d6d6d6;font:15px system-ui">`)}
      ${field('Email that receives enquiries and bookings for these posts', `<input name="contact_email" type="email" value="${esc(channel.contact_email || '')}" placeholder="support@revlo.ng" style="padding:10px;border-radius:10px;border:1.5px solid #d6d6d6;font:15px system-ui">`)}
      <div class="btns"><button class="ok" name="status" value="approved">Approve</button><button class="no" name="status" value="paused">Pause / do not import</button></div>
    </form>`);
}

export async function POST(request) {
  const form = await request.formData();
  const channel = await load(String(form.get('token') || ''));
  if (!channel) return page('Telegram channel', '<h1>Link not valid</h1>');
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  const email = String(form.get('contact_email') || '').trim().toLowerCase();
  const status = pick(String(form.get('status')), ['approved', 'paused'], 'paused');
  await supabaseAdmin.from('revlo_telegram_channels').update({
    status,
    default_category: pick(String(form.get('category')), CATEGORIES.map(c => c[0]), 'general'),
    default_area: pick(String(form.get('area')), AREAS, 'Nigeria'),
    duration: pick(String(form.get('duration')), ['now', '1m'], 'now'),
    credit: form.get('credit') !== 'no',
    credit_name: String(form.get('credit_name') || '').trim().slice(0, 60) || null,
    contact_email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) ? email : null,
    approved_at: status === 'approved' ? new Date().toISOString() : channel.approved_at,
  }).eq('chat_id', channel.chat_id);
  return page('Saved', status === 'approved'
    ? `<h1>Approved</h1><p>New posts in <strong>${esc(channel.title || channel.username)}</strong> will now appear on Revlo. Posts from before approval are not imported.</p>`
    : `<h1>Paused</h1><p>Nothing from <strong>${esc(channel.title || channel.username)}</strong> will be imported.</p>`);
}
