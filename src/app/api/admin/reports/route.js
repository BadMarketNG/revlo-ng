import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports
// Returns reported posts, with the reasons and counts, joined to post info.
export async function GET() {
  if (!await isAdminRequest()) {
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
    if (!byPost[r.post_id]) byPost[r.post_id] = { post_id: r.post_id, count: 0, reasons: {}, last: r.created_at, entries: [] };
    byPost[r.post_id].count += 1;
    byPost[r.post_id].reasons[r.reason] = (byPost[r.post_id].reasons[r.reason] || 0) + 1;
    byPost[r.post_id].entries.push({ id: r.id, reason: r.reason, created_at: r.created_at });
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

// DELETE /api/admin/reports { report_id } or { post_id }
// Deletes one complaint record, or every complaint attached to a post.
export async function DELETE(request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { report_id, post_id } = body || {};
  if (!report_id && !post_id) {
    return NextResponse.json({ error: 'report_id or post_id required' }, { status: 400 });
  }

  let query = supabaseAdmin.from('reports').delete();
  query = report_id ? query.eq('id', report_id) : query.eq('post_id', post_id);
  const { data: deleted, error } = await query.select('id,post_id');
  if (error) {
    console.error('[admin/reports:delete]', error);
    return NextResponse.json({ error: 'failed to delete report' }, { status: 500 });
  }

  await supabaseAdmin.from('admin_log').insert({
    action: report_id ? 'delete_report' : 'delete_post_reports',
    target_uid: report_id ? `report:${report_id}` : `post:${post_id}`,
    detail: { report_id: report_id || null, post_id: post_id || null, deleted_count: deleted?.length || 0 },
  });

  return NextResponse.json({ ok: true, deleted: deleted?.length || 0 });
}
