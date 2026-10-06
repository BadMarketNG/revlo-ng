import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeHomepageCopy } from '@/lib/homepageCopy.mjs';
import { normalizeSocialSettings } from '@/lib/socialSettings.mjs';

export const runtime = 'nodejs';
const allowed = new Set(['homepage.write', 'social-settings.write', 'cache.refresh']);
export async function POST(request) {
  const secret = process.env.AUTOMATION_LIVE_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const scriptId = String(request.headers.get('x-automation-script-id') || '').slice(0, 80);
  const permissions = new Set(String(request.headers.get('x-automation-permissions') || '').split(',').filter(value => allowed.has(value)));
  if (!scriptId) return NextResponse.json({ error: 'missing script identity' }, { status: 400 });
  const raw = await request.text(); if (raw.length > 20000) return NextResponse.json({ error: 'request too large' }, { status: 413 });
  let body = {}; try { body = JSON.parse(raw || '{}'); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (body.action === 'cache.refresh') { if (!permissions.has('cache.refresh')) return NextResponse.json({ error: 'permission denied' }, { status: 403 }); revalidatePath('/'); revalidatePath('/app.html'); return NextResponse.json({ ok: true, action: body.action, scriptId }); }
  if (body.action === 'homepage.update') { if (!permissions.has('homepage.write')) return NextResponse.json({ error: 'permission denied' }, { status: 403 }); const settings = normalizeHomepageCopy(body.payload || {}); const { error } = await supabaseAdmin.from('admin_log').insert({ action: 'homepage_copy_settings', target_uid: 'homepage', detail: { ...settings, automation_script_id: scriptId } }); if (error) return NextResponse.json({ error: 'update failed' }, { status: 500 }); revalidatePath('/app.html'); return NextResponse.json({ ok: true, action: body.action, scriptId }); }
  if (body.action === 'social-settings.update') { if (!permissions.has('social-settings.write')) return NextResponse.json({ error: 'permission denied' }, { status: 403 }); const settings = normalizeSocialSettings(body.payload || {}); if (!settings.categories.length) return NextResponse.json({ error: 'at least one category is required' }, { status: 400 }); const { error } = await supabaseAdmin.from('admin_log').insert({ action: 'social_publishing_settings', target_uid: 'social-publishing', detail: { id: true, x_enabled: settings.xEnabled, facebook_enabled: settings.facebookEnabled, categories: settings.categories, interval_hours: settings.intervalHours, hashtags: settings.hashtags, feed_description: settings.feedDescription, automation_script_id: scriptId, updated_at: new Date().toISOString() } }); if (error) return NextResponse.json({ error: 'update failed' }, { status: 500 }); return NextResponse.json({ ok: true, action: body.action, scriptId }); }
  return NextResponse.json({ error: 'action not allowed' }, { status: 400 });
}
