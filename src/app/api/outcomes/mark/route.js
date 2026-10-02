// Results (2026-10-02): GET shows "Sold / Let / Filled?" with a share-permission tick box; POST records
// the result with the real time since the post first went up, stops new bookings, and lets the post
// close within 12 hours. With permission, the result gets a shareable card at /r/<id>.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyToken } from '@/lib/util';
import { esc, page } from '@/lib/bookingPages.mjs';
import { duration, outcomeFor, resultLabel } from '@/lib/outcomes.mjs';

export const dynamic = 'force-dynamic';

async function load(token) {
  const claim = verifyToken(token);
  if (!claim || claim.action !== 'outcome') return {};
  const { data: post } = await supabaseAdmin.from('posts').select('uid,title,location,category,poster_email,created_at,expires_at').eq('uid', claim.uid).is('deleted_at', null).maybeSingle();
  if (!post || String(post.poster_email).toLowerCase() !== claim.email) return {};
  const { data: existing } = await supabaseAdmin.from('revlo_outcomes').select('*').eq('post_uid', post.uid).maybeSingle();
  return { post, existing };
}

const shareBlock = (outcome) => {
  const url = `https://revlo.ng/r/${outcome.id}`;
  const text = encodeURIComponent(`${outcome.label}: gone in ${duration(Number(outcome.hours))} on Revlo.ng. Post yours free: ${url}`);
  return `<p><a href="${url}">See your result card</a></p><div class="btns"><a class="btn ok" href="https://wa.me/?text=${text}">Share on WhatsApp</a></div>`;
};

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const { post, existing } = await load(token);
  if (!post) return page('Link not valid', '<h1>Link not valid</h1><p>This link has expired or is not valid. Ask for a new one from your post.</p>');
  if (existing) return page('Already marked', `<h1>${esc(existing.outcome === 'let' ? 'Let' : existing.outcome === 'sold' ? 'Sold' : 'Done')} in ${esc(duration(Number(existing.hours)))}</h1><p>${esc(post.title)}</p>${existing.share ? shareBlock(existing) : ''}`);
  const { verb } = outcomeFor(post.category);
  return page(`Mark as ${verb.toLowerCase()}`, `<h1>${esc(verb)} already?</h1><p><strong>${esc(post.title)}</strong></p>
    <form method="post"><input type="hidden" name="token" value="${esc(token)}">
      <label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0;font-size:14px"><input type="checkbox" name="share" value="yes" checked style="margin-top:3px">
        <span>Revlo may share this result, e.g. “${esc(resultLabel(post))}: ${esc(verb.toLowerCase())} in … via Revlo”. No names, emails or phone numbers are ever shown.</span></label>
      <div class="btns"><button class="ok">Yes, mark it ${esc(verb.toLowerCase())}</button></div>
    </form><p style="color:#888;font-size:13px">New enquiries and bookings stop, and the post closes within 12 hours.</p>`);
}

export async function POST(request) {
  const form = await request.formData();
  const { post, existing } = await load(String(form.get('token') || ''));
  if (!post) return page('Link not valid', '<h1>Link not valid</h1>');
  if (existing) return page('Already marked', `<h1>Already marked</h1>${existing.share ? shareBlock(existing) : ''}`);
  // The real time to the result counts from the post's first publication (before any bump).
  const { data: bump } = await supabaseAdmin.from('revlo_bumps').select('original_created_at').eq('post_uid', post.uid).order('bumped_at', { ascending: true }).limit(1).maybeSingle();
  const since = new Date(bump?.original_created_at || post.created_at).getTime();
  const hours = Math.max(0, (Date.now() - since) / 3600000);
  const { outcome, verb } = outcomeFor(post.category);
  const { data: saved, error } = await supabaseAdmin.from('revlo_outcomes').insert({
    post_uid: post.uid, outcome, category: post.category, label: resultLabel(post), hours: Math.round(hours * 100) / 100, share: form.get('share') === 'yes',
  }).select('*').single();
  if (error) return page('Try again', '<h1>Something went wrong</h1><p>Please try the link again.</p>');
  const closeAt = new Date(Math.min(new Date(post.expires_at).getTime(), Date.now() + 12 * 3600000)).toISOString();
  await Promise.all([
    supabaseAdmin.from('revlo_booking_settings').delete().eq('post_uid', post.uid),
    supabaseAdmin.from('posts').update({ expires_at: closeAt }).eq('uid', post.uid),
  ]);
  return page(`${verb}!`, `<h1>${esc(verb)} in ${esc(duration(hours))} 🎉</h1><p>Thanks for using Revlo. ${saved.share ? 'Share your result and help others find Revlo:' : 'Your post will close within 12 hours.'}</p>${saved.share ? shareBlock(saved) : ''}`);
}
