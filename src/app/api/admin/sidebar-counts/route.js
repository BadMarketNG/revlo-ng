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

  return NextResponse.json({
    counts: { stats: 0, reports: actionableReports, posts: 0, emails: 0, bm: 0 },
    updatedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
