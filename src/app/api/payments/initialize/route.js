import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/util';
import { publicOrigin } from '@/lib/publicOrigin';
import { findActiveBlock, requestIp } from '@/lib/revloBlocklist';
import { getFeatureSettings, getPublisherStatus } from '@/lib/revloFeatures';
import { initializeTransaction } from '@/lib/paystack';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const claim = verifyToken(body.publish_token);
  if (!claim || claim.action !== 'publish') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ip = requestIp(request);
  if (await findActiveBlock({ email: claim.email, ip })) return NextResponse.json({ error: 'unavailable' }, { status: 403 });
  const limited = await requireRateLimit({ action: 'payment:init:hour', key: `${claim.email}:${ip}`, limit: 10, windowSeconds: 3600 });
  if (limited) return limited;
  const settings = await getFeatureSettings();
  const status = await getPublisherStatus(claim.email);
  const kind = body.kind;
  let amount;
  let promoDays = null;
  if (kind === 'premium') {
    if (!status.premiumEligible) return NextResponse.json({ error: `Premium requires ${settings.premium_min_posts} posts.` }, { status: 403 });
    amount = settings.premium_price_kobo;
  } else if (kind === 'promo') {
    if (!settings.promotions_enabled) return NextResponse.json({ error: 'Promotions are currently unavailable.' }, { status: 403 });
    promoDays = Math.floor(Number(body.promo_days));
    if (promoDays < settings.promo_min_days || promoDays > settings.promo_max_days) return NextResponse.json({ error: 'invalid promotion duration' }, { status: 400 });
    amount = settings.promo_price_per_day_kobo * promoDays;
  } else return NextResponse.json({ error: 'invalid payment type' }, { status: 400 });
  const reference = `revlo-${kind}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const metadata = { kind, promo_days: promoDays, premium_days: settings.premium_days };
  const { error } = await supabaseAdmin.from('revlo_payment_intents').insert({ reference, email: claim.email, kind, amount_kobo: amount, promo_days: promoDays, metadata });
  if (error) return NextResponse.json({ error: 'Could not prepare payment.' }, { status: 500 });
  try {
    const data = await initializeTransaction({ email: claim.email, amount, reference, callbackUrl: `${publicOrigin()}/app.html?payment=${encodeURIComponent(reference)}`, metadata });
    return NextResponse.json({ reference, authorization_url: data.authorization_url, amount_kobo: amount });
  } catch (paymentError) {
    console.error('[payments:initialize]', paymentError);
    return NextResponse.json({ error: 'Could not start payment.' }, { status: 502 });
  }
}
