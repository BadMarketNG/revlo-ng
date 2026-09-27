import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { addAutomaticBlocks, blockedResponse, findActiveBlock, requestIp } from '@/lib/revloBlocklist';

export const dynamic = 'force-dynamic';

const VALID_REASONS = ['spam', 'false_info', 'offensive', 'copyright', 'other'];

// POST /api/report { uid, reason }
export async function POST(request) {
  const reporterIp = requestIp(request);
  if (await findActiveBlock({ ip: reporterIp })) return blockedResponse();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { uid, reason } = body || {};

  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'invalid reason' }, { status: 400 });
  }

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id')
    .eq('uid', uid)
    .maybeSingle();

  if (!post) return NextResponse.json({ error: 'post not found' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('reports')
    .insert({ post_id: post.id, reason, reporter_ip: reporterIp || null });

  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
    console.error('[report]', error);
    return NextResponse.json({ error: 'failed to report' }, { status: 500 });
  }

  if (reporterIp) {
    const { count } = await supabaseAdmin
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)
      .not('reporter_ip', 'is', null);
    if ((count || 0) >= 3) {
      const { data: reportedPost } = await supabaseAdmin
        .from('posts')
        .select('poster_email,source_ip')
        .eq('id', post.id)
        .maybeSingle();
      await supabaseAdmin.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', post.id);
      if (reportedPost) {
        await addAutomaticBlocks({
          email: reportedPost.poster_email,
          ip: reportedPost.source_ip,
          reason: 'A post reached three independent network reports',
          source: 'report_threshold',
          durationMs: 7 * 24 * 60 * 60 * 1000,
        });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
