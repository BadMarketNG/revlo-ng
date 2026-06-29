import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const VALID_REASONS = ['spam', 'false_info', 'offensive', 'copyright', 'other'];

// POST /api/report { uid, reason }
export async function POST(request) {
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
    .insert({ post_id: post.id, reason });

  if (error) {
    console.error('[report]', error);
    return NextResponse.json({ error: 'failed to report' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
