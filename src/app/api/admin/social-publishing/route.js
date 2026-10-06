import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCategories } from '@/lib/revloCategories';
import { getSocialSettings, normalizeFeedDescription, normalizeHashtags, SOCIAL_INTERVALS } from '@/lib/socialSettings.mjs';
import { runSocialPublishing, socialPlatformConfiguration } from '@/lib/socialRun.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const deny = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export async function GET() {
  if (!await isAdminRequest()) return deny();
  const [settings, categories] = await Promise.all([getSocialSettings(supabaseAdmin), getCategories()]);
  return NextResponse.json({ settings, categories: categories.map(({ slug, label }) => ({ slug, label })), configured: socialPlatformConfiguration(), intervals: SOCIAL_INTERVALS });
}

export async function PUT(request) {
  if (!await isAdminRequest()) return deny();
  const body = await request.json().catch(() => ({}));
  const catalogue = await getCategories();
  const valid = new Set(catalogue.map(category => category.slug));
  const categories = [...new Set((Array.isArray(body.categories) ? body.categories : []).map(String))].filter(category => valid.has(category));
  const intervalHours = Number(body.intervalHours);
  if (!categories.length) return NextResponse.json({ error: 'Choose at least one category.' }, { status: 400 });
  if (!SOCIAL_INTERVALS.includes(intervalHours)) return NextResponse.json({ error: 'Choose a supported posting interval.' }, { status: 400 });
  const row = {
    id: true,
    x_enabled: Boolean(body.xEnabled),
    facebook_enabled: Boolean(body.facebookEnabled),
    categories,
    interval_hours: intervalHours,
    hashtags: normalizeHashtags(body.hashtags),
    feed_description: normalizeFeedDescription(body.feedDescription),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from('admin_log').insert({ action: 'social_publishing_settings', target_uid: 'social-publishing', detail: row });
  if (error) return NextResponse.json({ error: 'Could not save social publishing settings.' }, { status: 500 });
  return NextResponse.json({ ok: true, settings: await getSocialSettings(supabaseAdmin) });
}

export async function POST(request) {
  if (!await isAdminRequest()) return deny();
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'run') return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  try {
    const result = await runSocialPublishing({ force: true });
    await supabaseAdmin.from('admin_log').insert({ action: 'social_publishing_run', target_uid: 'social-publishing', detail: { counts: result.counts, results: result.results } });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[admin:social-publishing]', error);
    return NextResponse.json({ error: 'Social publishing could not run.' }, { status: 500 });
  }
}
