import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/bm-links -> all BadMarket links with their post info
export async function GET() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: links, error } = await supabaseAdmin
    .from('bm_links')
    .select('id, payout_email, created_at, post_id')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('[admin/bm-links]', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }

  const postIds = (links || []).map((l) => l.post_id);
  let postsById = {};
  if (postIds.length) {
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select('id, uid, title')
      .in('id', postIds);
    for (const p of posts || []) postsById[p.id] = p;
  }

  const result = (links || []).map((l) => ({
    payout_email: l.payout_email,
    created_at: l.created_at,
    uid: postsById[l.post_id]?.uid || null,
    title: postsById[l.post_id]?.title || '(post deleted)',
  }));

  return NextResponse.json({ links: result });
}
