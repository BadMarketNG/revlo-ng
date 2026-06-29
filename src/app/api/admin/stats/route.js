import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/stats
export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('duration, views, expires_at, deleted_at');

  const stats = {
    total: 0,
    active: 0,
    expired: 0,
    deleted: 0,
    totalViews: 0,
    byDuration: { now: 0, '1m': 0, '2m': 0, '3m': 0 },
  };

  for (const p of posts || []) {
    stats.total += 1;
    stats.totalViews += p.views || 0;
    if (p.deleted_at) {
      stats.deleted += 1;
    } else if (p.expires_at < now) {
      stats.expired += 1;
    } else {
      stats.active += 1;
      if (stats.byDuration[p.duration] !== undefined) stats.byDuration[p.duration] += 1;
    }
  }

  const { count: followCount } = await supabaseAdmin
    .from('follows')
    .select('*', { count: 'exact', head: true });
  const { count: reportCount } = await supabaseAdmin
    .from('reports')
    .select('*', { count: 'exact', head: true });
  const { count: bmCount } = await supabaseAdmin
    .from('bm_links')
    .select('*', { count: 'exact', head: true });

  stats.follows = followCount || 0;
  stats.reports = reportCount || 0;
  stats.bmLinks = bmCount || 0;

  return NextResponse.json({ stats });
}
