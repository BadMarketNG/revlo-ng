import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { serviceSecretMatches } from '@/lib/adminSso';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  let authorised = false;
  try { authorised = serviceSecretMatches(request.headers.get('authorization')); } catch { authorised = false; }
  if (!authorised) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: reports, error: reportError } = await supabaseAdmin.from('reports').select('post_id');
  if (reportError) return NextResponse.json({ error: 'counts unavailable' }, { status: 503 });
  const postIds = [...new Set((reports || []).map((report) => report.post_id).filter(Boolean))];
  let actionableReports = 0;
  if (postIds.length > 0) {
    const { count, error } = await supabaseAdmin.from('posts').select('id', { count: 'exact', head: true }).in('id', postIds).is('deleted_at', null);
    if (error) return NextResponse.json({ error: 'counts unavailable' }, { status: 503 });
    actionableReports = count || 0;
  }

  const activeSince = new Date(Date.now() - 75_000).toISOString();
  const { data: visitorRows, error: visitorError } = await supabaseAdmin
    .from('public_visitor_presence')
    .select('visitor_id,path')
    .gte('last_seen_at', activeSince)
    .limit(5000);
  const pages = {};
  if (!visitorError) {
    for (const row of visitorRows || []) pages[row.path || '/'] = (pages[row.path || '/'] || 0) + 1;
  }
  await supabaseAdmin.from('public_visitor_presence').delete().lt('last_seen_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json({
    counts: { stats: 0, reports: actionableReports, posts: 0, emails: 0, bm: 0 },
    visitors: { count: visitorError ? 0 : (visitorRows || []).length, pages: visitorError ? {} : pages },
    updatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
