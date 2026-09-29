import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const PUBLIC_COLS =
  'uid,title,description,location,header_url,thumb_url,media_type,video_url,gallery,contact_visibility,followable,duration,views,followers,created_at,expires_at';

// GET /api/posts/[uid] -> fetch one post. Feed views are recorded only after
// the post's scroll-progress rail is completed (see /api/posts/[uid]/view).
export async function GET(request, { params }) {
  const { uid } = await params;

  const { data, error } = await supabaseAdmin
    .from('posts')
    .select(PUBLIC_COLS)
    .eq('uid', uid)
    .is('deleted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error('[post:GET]', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not found or expired' }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}
