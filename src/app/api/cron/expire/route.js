import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/cron/expire  -> deletes posts past their expires_at.
// Protected: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('posts')
    .delete()
    .lt('expires_at', now)
    .select('uid');

  if (error) {
    console.error('[cron:expire]', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, deleted: data?.length || 0 });
}
