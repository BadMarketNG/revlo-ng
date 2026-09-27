import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// GET /api/admin/emails
// Returns all follow subscriptions and distinct poster emails. Admin only.
export async function GET() {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: follows } = await supabaseAdmin
    .from('follows')
    .select('poster_email, follower_email, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);

  const { data: posters } = await supabaseAdmin
    .from('posts')
    .select('poster_email')
    .is('deleted_at', null);

  const posterSet = Array.from(new Set((posters || []).map((p) => p.poster_email))).sort();

  return NextResponse.json({
    follows: follows || [],
    posters: posterSet,
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
