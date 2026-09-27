import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/emails
// Returns publish-link delivery/use history and follow subscriptions. Admin only.
export async function GET() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: follows } = await supabaseAdmin
    .from('follows')
    .select('poster_email, follower_email, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);

  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('uid,poster_email,title,created_at,deleted_at')
    .order('created_at', { ascending: false })
    .limit(2000);

  const { data: magicLinks, error: magicLinksError } = await supabaseAdmin
    .from('revlo_magic_link_events')
    .select('id,email,delivery_status,requested_at,sent_at,opened_at,redeemed_at,expires_at,post_uid')
    .order('requested_at', { ascending: false })
    .limit(5000);

  if (magicLinksError) {
    console.error('[admin:emails]', magicLinksError.code || magicLinksError.message);
    return NextResponse.json({ error: 'failed to load magic-link history' }, { status: 500 });
  }

  const trackedPostUids = new Set((magicLinks || []).map((row) => row.post_uid).filter(Boolean));
  const historicalPosts = (posts || [])
    .filter((post) => !trackedPostUids.has(post.uid))
    .map((post) => ({
      id: `historical-${post.uid}`,
      email: post.poster_email,
      delivery_status: 'historical',
      requested_at: post.created_at,
      sent_at: null,
      opened_at: null,
      redeemed_at: post.created_at,
      expires_at: null,
      post_uid: post.uid,
      post_title: post.title,
      deleted_at: post.deleted_at,
    }));

  const postByUid = new Map((posts || []).map((post) => [post.uid, post]));
  const publishLinks = (magicLinks || []).map((row) => ({
    ...row,
    post_title: row.post_uid ? postByUid.get(row.post_uid)?.title || null : null,
    deleted_at: row.post_uid ? postByUid.get(row.post_uid)?.deleted_at || null : null,
  }));

  const posterSet = Array.from(new Set((posts || []).map((p) => p.poster_email))).sort();

  return NextResponse.json({
    follows: follows || [],
    posters: posterSet,
    publishLinks,
    historicalPosts,
  });
}

// POST /api/admin/emails  { poster_email, follower_email }  -> admin unsubscribe
export async function POST(request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { poster_email, follower_email } = body || {};
  if (!poster_email || !follower_email) {
    return NextResponse.json({ error: 'poster_email and follower_email required' }, { status: 400 });
  }

  await supabaseAdmin
    .from('follows')
    .delete()
    .eq('poster_email', poster_email)
    .eq('follower_email', follower_email);

  supabaseAdmin
    .from('admin_log')
    .insert({ action: 'unsubscribe', detail: { poster_email, follower_email } })
    .then(() => {})
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
