import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { postWithoutLinks } from '@/lib/postLinks.mjs';
import { requestIp } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

// ORIGINAL (commented out 2026-09-30):
// const PUBLIC_COLS =
//   'uid,title,description,location,header_url,thumb_url,media_type,video_url,gallery,contact_visibility,followable,duration,views,followers,created_at,expires_at';
// NOTE: includes the publisher's public alias.
const PUBLIC_COLS =
  'uid,title,description,location,category,post_type,budget_max,needed_by,header_url,thumb_url,media_type,video_url,gallery,contact_visibility,followable,duration,views,followers,poster_alias,tags,created_at,expires_at';

// GET /api/posts/[uid] -> fetch one post. Feed views are recorded only after
// the post's scroll-progress rail is completed (see /api/posts/[uid]/view).
export async function GET(request, { params }) {
  const readLimited = await requireRateLimit({
    action: 'public-post-read:5m',
    key: requestIp(request),
    limit: 180,
    windowSeconds: 300,
  });
  if (readLimited) return readLimited;
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

  return NextResponse.json({ post: postWithoutLinks(data) });
}
