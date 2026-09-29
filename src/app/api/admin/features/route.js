import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getFeatureSettings } from '@/lib/revloFeatures';
import { isConfiguredCategory } from '@/lib/revloCategories';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ settings: await getFeatureSettings() });
}

export async function PATCH(request) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  // NOTE (2026-09-29): silver/bronze/gold_link_posts are the posts one publish link allows per badge.
  const integerFields = ['silver_posts','bronze_posts','gold_posts','premium_min_posts','premium_price_kobo','premium_days','promo_price_per_day_kobo','promo_min_days','promo_max_days','normal_link_posts','silver_link_posts','bronze_link_posts','gold_link_posts'];
  const update = { updated_at: new Date().toISOString() };
  for (const field of integerFields) {
    if (body[field] !== undefined) {
      const value = Math.floor(Number(body[field]));
      if (!Number.isFinite(value) || value < 1) return NextResponse.json({ error: `invalid ${field}` }, { status: 400 });
      update[field] = value;
    }
  }
  if (body.promotions_enabled !== undefined) update.promotions_enabled = Boolean(body.promotions_enabled);
  const merged = { ...(await getFeatureSettings()), ...update };
  if (!(merged.silver_posts < merged.bronze_posts && merged.bronze_posts < merged.gold_posts)) return NextResponse.json({ error: 'Badge thresholds must increase from Silver to Bronze to Gold.' }, { status: 400 });
  if (['normal_link_posts', 'silver_link_posts', 'bronze_link_posts', 'gold_link_posts'].some((field) => merged[field] > 1000)) return NextResponse.json({ error: 'A publish link can allow at most 1,000 posts.' }, { status: 400 });
  if (merged.promo_min_days > merged.promo_max_days) return NextResponse.json({ error: 'Promotion minimum cannot exceed maximum.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('revlo_feature_settings').update(update).eq('id', true).select('*').single();
  if (error) return NextResponse.json({ error: 'Could not save settings.' }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function POST(request) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const targetUrl = String(body.target_url || '').trim();
  const days = Math.floor(Number(body.days));
  let parsed;
  try { parsed = new URL(targetUrl); } catch { return NextResponse.json({ error: 'A valid destination URL is required.' }, { status: 400 }); }
  if (!['http:', 'https:'].includes(parsed.protocol) || title.length < 2 || title.length > 160 || days < 1 || days > 365) return NextResponse.json({ error: 'Invalid promotion.' }, { status: 400 });
  let imageUrl = null;
  if (body.image_url) {
    try {
      const image = new URL(String(body.image_url));
      if (!['http:', 'https:'].includes(image.protocol)) throw new Error('protocol');
      imageUrl = image.toString();
    } catch { return NextResponse.json({ error: 'Image URL must use HTTP or HTTPS.' }, { status: 400 }); }
  }
  if (body.category && !await isConfiguredCategory(body.category)) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
  const placement = body.placement === 'header' ? 'header' : 'feed';
  const { data, error } = await supabaseAdmin.from('revlo_promotions').insert({
    title, description: String(body.description || '').slice(0, 500), image_url: imageUrl,
    target_url: targetUrl, category: body.category || null, placement, source: 'admin',
    ends_at: new Date(Date.now() + days * 86400000).toISOString(), active: true,
  }).select('*').single();
  if (error) return NextResponse.json({ error: 'Could not create promotion.' }, { status: 500 });
  return NextResponse.json({ promotion: data }, { status: 201 });
}
