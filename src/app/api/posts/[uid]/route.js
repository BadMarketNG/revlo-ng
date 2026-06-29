import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const PUBLIC_COLS =
  'uid,title,description,location,header_url,thumb_url,media_type,video_url,gallery,contact_visibility,followable,duration,views,followers,created_at,expires_at';

// GET /api/posts/[uid] -> fetch one post and increment its view count
export async function GET(request, { params }) {
  const { uid } = params;

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

  // Increment views (best-effort)
  supabaseAdmin
    .from('posts')
    .update({ views: (data.views || 0) + 1 })
    .eq('uid', uid)
    .then(() => {})
    .catch(() => {});

  return NextResponse.json({ post: { ...data, views: (data.views || 0) + 1 } });
}
