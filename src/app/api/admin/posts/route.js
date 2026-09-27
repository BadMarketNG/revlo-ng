import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';
import { isValidDuration } from '@/lib/util';

export const dynamic = 'force-dynamic';

// GET /api/admin/posts?duration=now[&all=1]
// Returns full post rows INCLUDING poster_email. Admin only.
// By default returns non-deleted posts for the tab; ?all=1 returns everything.
export async function GET(request) {
  if (!await isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const all = searchParams.get('all') === '1';
  const duration = searchParams.get('duration');

  let query = supabaseAdmin.from('posts').select('*').order('created_at', { ascending: false });

  if (!all) {
    query = query.is('deleted_at', null);
    if (duration && isValidDuration(duration)) query = query.eq('duration', duration);
  }

  const { data, error } = await query.limit(500);
  if (error) {
    console.error('[admin/posts]', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ posts: data });
}
