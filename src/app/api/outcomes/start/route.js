// Results (2026-10-02): the poster asks to mark their post as gone; we email the post's own address.
// The reply is the same whether or not the email matches, so nobody learns who posted what.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRateLimit } from '@/lib/security';
import { requestIp } from '@/lib/revloBlocklist';
import { sendEmail } from '@/lib/email';
import { markEmail } from '@/lib/outcomeLinks.mjs';

export const dynamic = 'force-dynamic';
const SAME = { ok: true, message: 'If that is the email this post was made with, we have sent it a link.' };

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const uid = String(body.uid || '');
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9-]{4,24}$/.test(uid) || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return NextResponse.json({ error: 'Enter the email you used for this post.' }, { status: 400 });
  const limited = await requireRateLimit({ action: 'outcome:ip', key: requestIp(request), limit: 10, windowSeconds: 3600 });
  if (limited) return limited;
  const { data: post } = await supabaseAdmin.from('posts').select('uid,title,category,poster_email').eq('uid', uid).is('deleted_at', null).maybeSingle();
  if (post && String(post.poster_email).toLowerCase() === email) await sendEmail({ to: email, ...markEmail(post) });
  return NextResponse.json(SAME);
}
