// Bump up (2026-10-02): the poster asks to bump; we email a payment link to the post's own email.
// The answer is the same whether or not the email matches, so nobody can learn who posted what.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRateLimit } from '@/lib/security';
import { requestIp } from '@/lib/revloBlocklist';
import { sendEmail } from '@/lib/email';
import { signToken } from '@/lib/util';
import { BUMP_HOURS, bumpPriceKobo, liveBumps, naira } from '@/lib/bumps.mjs';
import { esc } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';
const SAME = { ok: true, message: 'If that is the email this post was made with, we have sent it a bump link.' };

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const uid = String(body.uid || '');
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9-]{4,24}$/.test(uid) || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return NextResponse.json({ error: 'Enter the email you used for this post.' }, { status: 400 });
  const limited = await requireRateLimit({ action: 'bump:ip', key: requestIp(request), limit: 10, windowSeconds: 3600 })
    || await requireRateLimit({ action: 'bump:post', key: uid, limit: 5, windowSeconds: 3600 });
  if (limited) return limited;
  const { data: post } = await supabaseAdmin.from('posts').select('uid,title,poster_email').eq('uid', uid).is('deleted_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!post || String(post.poster_email).toLowerCase() !== email) return NextResponse.json(SAME);
  if ((await liveBumps(supabaseAdmin)).includes(uid)) return NextResponse.json({ ok: true, message: `This post is already bumped. You can bump it again ${BUMP_HOURS} hours after the last bump.` });
  const token = signToken({ action: 'bump', uid, email }, 24 * 3600000);
  const payUrl = `https://revlo.ng/api/bumps/pay?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: `Bump your Revlo.ng post to the top: ${post.title}`.slice(0, 150),
    html: `<p>Put <strong>${esc(post.title)}</strong> back at the top of Revlo.ng for ${BUMP_HOURS} hours, labelled “Bumped”, for <strong>${naira(bumpPriceKobo())}</strong>.</p><p><a href="${payUrl}">Bump my post</a></p><p style="color:#888;font-size:13px">This link works for 24 hours. If you did not ask for it, ignore this email.</p>`,
  });
  return NextResponse.json(SAME);
}
