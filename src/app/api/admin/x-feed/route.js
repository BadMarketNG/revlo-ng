// Admin: X feed (2026-10-03). GET: budget settings, searches and usage. PUT: budget settings.
// POST: create/update a search, or { action: 'run' } to refresh now (within the caps). DELETE: a search.
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCategories } from '@/lib/revloCategories';
import { getXSearches, getXSettings } from '@/lib/xFeed.mjs';
import { runXFeed, xUsage } from '@/lib/xFeedRun.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const deny = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export async function GET() {
  if (!await isAdminRequest()) return deny();
  const [settings, searches, categories, { data: raw }] = await Promise.all([
    getXSettings(supabaseAdmin), getXSearches(supabaseAdmin, { includeDisabled: true }), getCategories(),
    supabaseAdmin.from('revlo_x_settings').select('*').eq('id', true).maybeSingle(),
  ]);
  const usage = await xUsage(settings);
  return NextResponse.json({
    settings, saved: raw || null, searches, categories: categories.map(c => ({ slug: c.slug, label: c.label })),
    usage: { ...usage, periodSpend: +(usage.periodRead * settings.pricePerPost).toFixed(2), monthSpend: +(usage.monthRead * settings.pricePerPost).toFixed(2) },
  });
}

export async function PUT(request) {
  if (!await isAdminRequest()) return deny();
  const body = await request.json().catch(() => ({}));
  const num = (v, min, max) => (v === null || v === '' || v === undefined ? null : Math.min(max, Math.max(min, Number(v))));
  const row = {
    id: true,
    enabled: typeof body.enabled === 'boolean' ? body.enabled : null,
    period_posts: num(body.period_posts, 10, 100000),
    period_days: num(body.period_days, 1, 31),
    monthly_usd: num(body.monthly_usd, 0, 100000),
    price_per_post: body.price_per_post === null || body.price_per_post === '' ? null : Math.max(0.0001, Number(body.price_per_post)),
    updated_at: new Date().toISOString(),
  };
  if (row.period_posts !== null) row.period_posts = Math.floor(row.period_posts);
  if (row.period_days !== null) row.period_days = Math.floor(row.period_days);
  const { error } = await supabaseAdmin.from('revlo_x_settings').upsert(row);
  if (error) return NextResponse.json({ error: 'Could not save the budget.' }, { status: 500 });
  return NextResponse.json({ ok: true, settings: await getXSettings(supabaseAdmin) });
}

export async function POST(request) {
  if (!await isAdminRequest()) return deny();
  const body = await request.json().catch(() => ({}));
  if (body.action === 'run') return NextResponse.json({ ok: true, ...(await runXFeed()) });
  const name = String(body.name || '').trim().slice(0, 60);
  const terms = String(body.terms || '').trim();
  const category = String(body.category || '');
  const national = Boolean(body.national);
  const cities = national ? ['Nigeria'] : [...new Set((Array.isArray(body.cities) ? body.cities : String(body.cities || '').split(',')).map(c => String(c).trim()).filter(Boolean))].slice(0, 10);
  if (name.length < 2) return NextResponse.json({ error: 'Give the search a name.' }, { status: 400 });
  if (terms.length < 3 || terms.length > 420) return NextResponse.json({ error: 'Search words must be 3 to 420 characters (X limits a search to 512, including the city).' }, { status: 400 });
  if (!(await getCategories()).some(c => c.slug === category)) return NextResponse.json({ error: 'Choose the category its posts go into.' }, { status: 400 });
  if (!national && !cities.length) return NextResponse.json({ error: 'Add at least one city, or make it national.' }, { status: 400 });
  const row = { name, terms, category, national, cities, match_words: String(body.match_words || '').slice(0, 600), enabled: body.enabled !== false, position: Number(body.position) || 100 };
  const { error } = body.id
    ? await supabaseAdmin.from('revlo_x_searches').update(row).eq('id', body.id)
    : await supabaseAdmin.from('revlo_x_searches').insert(row);
  if (error) return NextResponse.json({ error: 'Could not save the search.' }, { status: 500 });
  return NextResponse.json({ ok: true, searches: await getXSearches(supabaseAdmin, { includeDisabled: true }) });
}

export async function DELETE(request) {
  if (!await isAdminRequest()) return deny();
  const body = await request.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/.test(String(body.id || ''))) return NextResponse.json({ error: 'invalid search' }, { status: 400 });
  await supabaseAdmin.from('revlo_x_searches').delete().eq('id', body.id);
  return NextResponse.json({ ok: true });
}
