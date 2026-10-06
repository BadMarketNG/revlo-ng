import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getHomepageCopy, normalizeHomepageCopy } from '@/lib/homepageCopy.mjs';

export const dynamic = 'force-dynamic';
const deny = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export async function GET() {
  if (!await isAdminRequest()) return deny();
  return NextResponse.json({ settings: await getHomepageCopy(supabaseAdmin) });
}

export async function PUT(request) {
  if (!await isAdminRequest()) return deny();
  const settings = normalizeHomepageCopy(await request.json().catch(() => ({})));
  const { error } = await supabaseAdmin.from('admin_log').insert({
    action: 'homepage_copy_settings',
    target_uid: 'homepage',
    detail: settings,
  });
  if (error) return NextResponse.json({ error: 'Could not save homepage copy.' }, { status: 500 });
  return NextResponse.json({ ok: true, settings });
}
