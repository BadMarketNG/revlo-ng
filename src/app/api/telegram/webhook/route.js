// Telegram partner channels (2026-10-02, additive). Telegram calls this for every update the Revlo bot
// receives. When the bot is added to a channel, support@revlo.ng gets an approval email; posts from
// approved channels become Revlo posts (photo copied, category and city detected, edits followed).
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { signToken, makeUid, expiryFor } from '@/lib/util';
import { flagPostForContactInfo } from '@/lib/moderation';
import { copyPhoto, secretMatches } from '@/lib/telegramBot.mjs';
import { telegramToPost } from '@/lib/telegramImport.mjs';
import { JOB_ICONS, hash } from '@/lib/jobImport.mjs';
import { notifyIndexNow } from '@/lib/indexNow.mjs';
import { esc } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PARTNER_EMAIL = process.env.REVLO_PARTNER_EMAIL || 'support@revlo.ng';
const DAILY_LIMIT = 50;
// Sample images per category (from the sample posts), used when a channel post has no photo.
const SAMPLES = { jobs: ['jobs-1', 'jobs-2', 'jobs-3', 'jobs-4', 'jobs-5'], rentals: ['rentals-2', 'rentals-3', 'rentals-5'], for_sale: ['for_sale-3', 'for_sale-4', 'for_sale-5'], promotions: ['promotions-1', 'promotions-2', 'promotions-4', 'promotions-5'], general: ['general-1', 'general-3', 'general-4'] };
const sample = (category, seed) => { const list = SAMPLES[category] || SAMPLES.general; return `https://revlo.ng/samples/headers/${list[hash(seed) % list.length]}.jpg`; };
const icon = seed => `https://revlo.ng/samples/icons/icon-${JOB_ICONS[(hash(seed) >> 3) % JOB_ICONS.length]}.jpg`;

async function botAdded(chat, status) {
  if (!['administrator', 'member'].includes(status)) {
    await supabaseAdmin.from('revlo_telegram_channels').update({ status: 'removed' }).eq('chat_id', chat.id);
    return;
  }
  const { data: existing } = await supabaseAdmin.from('revlo_telegram_channels').select('status').eq('chat_id', chat.id).maybeSingle();
  if (existing && existing.status !== 'removed') return;
  await supabaseAdmin.from('revlo_telegram_channels').upsert({ chat_id: chat.id, title: chat.title || null, username: chat.username || null, chat_type: chat.type, status: 'pending', added_at: new Date().toISOString() });
  const token = signToken({ action: 'tg-approve', chat: chat.id }, 14 * 86400000);
  await sendEmail({
    to: PARTNER_EMAIL,
    subject: `Telegram channel wants to join Revlo: ${chat.title || chat.username || chat.id}`.slice(0, 150),
    html: `<p>The Revlo bot was added to the Telegram ${esc(chat.type)} <strong>${esc(chat.title || '')}</strong>${chat.username ? ` (<a href="https://t.me/${esc(chat.username)}">@${esc(chat.username)}</a>)` : ''}.</p>
           <p>Nothing is imported until you approve it. Only approve channels whose owner has agreed to share their posts on Revlo.</p>
           <p><a href="https://revlo.ng/api/telegram/approve?token=${encodeURIComponent(token)}">Review and approve this channel</a></p>`,
  });
}

async function importMessage(message, { edited = false } = {}) {
  const { data: channel } = await supabaseAdmin.from('revlo_telegram_channels').select('*').eq('chat_id', message.chat.id).maybeSingle();
  if (!channel || channel.status !== 'approved') return;
  const fields = telegramToPost(message, channel);
  if (!fields) return;
  const { data: known } = await supabaseAdmin.from('revlo_telegram_posts').select('post_uid').eq('chat_id', message.chat.id).eq('message_id', message.message_id).maybeSingle();
  if (edited) {
    if (known?.post_uid) await supabaseAdmin.from('posts').update({ title: fields.title, description: fields.description, location: fields.location }).eq('uid', known.post_uid);
    return;
  }
  if (known) return;
  const { count } = await supabaseAdmin.from('revlo_telegram_posts').select('message_id', { count: 'exact', head: true }).eq('chat_id', message.chat.id).gt('imported_at', new Date(Date.now() - 86400000).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return;
  // Claim the message (and its album) first so retries and album siblings are not imported twice.
  const { error: claimError } = await supabaseAdmin.from('revlo_telegram_posts').insert({ chat_id: message.chat.id, message_id: message.message_id, media_group_id: message.media_group_id || null });
  if (claimError) return;
  const seed = `${message.chat.id}:${message.message_id}`;
  const photo = message.photo ? await copyPhoto(supabaseAdmin, message.photo).catch(() => null) : null;
  const uid = makeUid();
  const duration = channel.duration === '1m' ? '1m' : 'now';
  const post = {
    uid,
    poster_email: (channel.contact_email || PARTNER_EMAIL).toLowerCase(),
    ...fields,
    header_url: photo || sample(fields.category, seed),
    thumb_url: icon(seed),
    media_type: 'images', gallery: [], contact_visibility: 'public', followable: true,
    duration, expires_at: expiryFor(duration), trust_badge: null, premium_badge: false,
  };
  const { error } = await supabaseAdmin.from('posts').insert(post);
  if (error) {
    console.error('[telegram:import]', error.code || error.message);
    await supabaseAdmin.from('revlo_telegram_posts').delete().eq('chat_id', message.chat.id).eq('message_id', message.message_id);
    return;
  }
  await supabaseAdmin.from('revlo_telegram_posts').update({ post_uid: uid }).eq('chat_id', message.chat.id).eq('message_id', message.message_id);
  // Same rule as other posts: phone numbers, emails and links go to admin review.
  await flagPostForContactInfo({ ...post }).catch(() => {});
  await notifyIndexNow(`https://revlo.ng/p/${uid}`);
}

export async function POST(request) {
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const update = await request.json().catch(() => null);
  try {
    if (update?.my_chat_member) await botAdded(update.my_chat_member.chat, update.my_chat_member.new_chat_member?.status);
    const message = update?.channel_post || update?.message;
    const edited = update?.edited_channel_post || update?.edited_message;
    if (message?.chat && message.chat.type !== 'private') await importMessage(message);
    if (edited?.chat && edited.chat.type !== 'private') await importMessage(edited, { edited: true });
  } catch (error) {
    console.error('[telegram:webhook]', error?.message || error);
  }
  // Always 200, so Telegram does not resend the same update over and over.
  return NextResponse.json({ ok: true });
}
