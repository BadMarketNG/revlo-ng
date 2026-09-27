import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';

export const dynamic = 'force-dynamic';

// GET /api/cron/expire  -> deletes posts past their expires_at.
// Protected: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request) {
  const auth = request.headers.get('authorization') || '';
  let secret;
  try {
    secret = requiredSecret('CRON_SECRET');
  } catch (error) {
    console.error('[cron:expire]', error.message);
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
  if (!constantTimeBearerMatches(auth, secret)) {
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
  const retention = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  await Promise.all([
    supabaseAdmin.from('revlo_rate_limit_events').delete().lt('created_at', retention),
    supabaseAdmin.from('revlo_pending_public_actions').delete().lt('expires_at', now),
  ]);
  return NextResponse.json({ ok: true, deleted: data?.length || 0 });
}
