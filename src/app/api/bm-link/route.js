import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';

export const dynamic = 'force-dynamic';

// POST /api/bm-link { uid, payout_email }
// Links a Revlo post to a BadMarket.ng community page (report/comment/vote).
// One-time only per post -- enforced by the UNIQUE constraint on bm_links.post_id.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { uid, payout_email } = body || {};

  if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
  if (!isEmail(payout_email))
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });

  const { data: post } = await supabaseAdmin
    .from('posts')
    .select('id,uid')
    .eq('uid', uid)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'post not found' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('bm_links')
    .insert({ post_id: post.id, payout_email: payout_email.trim().toLowerCase() });

  if (error) {
    if (error.code === '23505') {
      // unique_violation -> already linked once
      return NextResponse.json(
        { error: 'this post is already linked to BadMarket.ng' },
        { status: 409 }
      );
    }
    console.error('[bm-link]', error);
    return NextResponse.json({ error: 'failed to link' }, { status: 500 });
  }

  const bmBase = process.env.BADMARKET_URL || 'https://badmarket.ng';
  return NextResponse.json({
    ok: true,
    community_url: `${bmBase}/p/${post.uid}`,
  });
}
