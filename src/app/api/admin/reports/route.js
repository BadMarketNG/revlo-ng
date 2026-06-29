import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports
// Returns reported posts, with the reasons and counts, joined to post info.
export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select('id, reason, created_at, post_id')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('[admin/reports]', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }

  // Group by post_id.
  const byPost = {};
  for (const r of reports || []) {
    if (!byPost[r.post_id]) byPost[r.post_id] = { post_id: r.post_id, count: 0, reasons: {}, last: r.created_at };
    byPost[r.post_id].count += 1;
    byPost[r.post_id].reasons[r.reason] = (byPost[r.post_id].reasons[r.reason] || 0) + 1;
  }

  const postIds = Object.keys(byPost);
  if (postIds.length === 0) return NextResponse.json({ reports: [] });

  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('id, uid, title, location, poster_email, deleted_at, duration')
    .in('id', postIds);

  const result = (posts || []).map((p) => ({
    ...byPost[p.id],
    uid: p.uid,
    title: p.title,
    location: p.location,
    poster_email: p.poster_email,
    deleted: !!p.deleted_at,
    duration: p.duration,
  }));
  // Most-reported first.
  result.sort((a, b) => b.count - a.count);

  return NextResponse.json({ reports: result });
}
