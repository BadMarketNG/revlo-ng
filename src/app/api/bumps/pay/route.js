// Bump up (2026-10-02): GET shows the price and a Pay button; POST starts the Paystack payment.
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyToken } from '@/lib/util';
import { initializeTransaction } from '@/lib/paystack';
import { BUMP_HOURS, bumpPriceKobo, liveBumps, naira } from '@/lib/bumps.mjs';
import { esc, page } from '@/lib/bookingPages.mjs';

export const dynamic = 'force-dynamic';

async function check(token) {
  const claim = verifyToken(token);
  if (!claim || claim.action !== 'bump') return { error: 'This bump link has expired or is not valid. Ask for a new one from the post.' };
  const { data: post } = await supabaseAdmin.from('posts').select('uid,title,poster_email').eq('uid', claim.uid).is('deleted_at', null).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (!post || String(post.poster_email).toLowerCase() !== claim.email) return { error: 'This post is no longer live.' };
  if ((await liveBumps(supabaseAdmin)).includes(post.uid)) return { error: `This post is already bumped. You can bump it again ${BUMP_HOURS} hours after the last bump.` };
  return { claim, post };
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  const { error, post } = await check(token);
  if (error) return page('Bump up', `<h1>Bump up</h1><p>${esc(error)}</p>`);
  return page('Bump up', `<h1>Bump to the top</h1><p><strong>${esc(post.title)}</strong> goes back to the top of Revlo.ng and into “Right now” for ${BUMP_HOURS} hours, labelled “Bumped”.</p><form method="post" class="btns"><input type="hidden" name="token" value="${esc(token)}"><button class="ok">Pay ${naira(bumpPriceKobo())} with Paystack</button></form><p style="color:#888;font-size:13px">Your post keeps its original expiry date.</p>`);
}

export async function POST(request) {
  const token = String((await request.formData()).get('token') || '');
  const { error, claim, post } = await check(token);
  if (error) return page('Bump up', `<h1>Bump up</h1><p>${esc(error)}</p>`);
  const amount = bumpPriceKobo();
  const reference = `revlo-bump-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const metadata = { kind: 'bump', post_uid: post.uid };
  const { error: saveError } = await supabaseAdmin.from('revlo_payment_intents').insert({ reference, email: claim.email, kind: 'bump', amount_kobo: amount, post_uid: post.uid, metadata });
  if (saveError) return page('Bump up', '<h1>Bump up</h1><p>Could not prepare the payment. Please try again.</p>');
  try {
    const data = await initializeTransaction({ email: claim.email, amount, reference, callbackUrl: `https://revlo.ng/api/bumps/done?reference=${encodeURIComponent(reference)}`, metadata });
    return NextResponse.redirect(data.authorization_url, 303);
  } catch (paymentError) {
    console.error('[bumps:pay]', paymentError?.message);
    return page('Bump up', '<h1>Bump up</h1><p>Could not start the payment. Please try again.</p>');
  }
}
