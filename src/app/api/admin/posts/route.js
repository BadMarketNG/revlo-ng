import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';
import { isValidDuration } from '@/lib/util';
// NOTE (2026-10-03, Claude): original listing links for support@revlo.ng posts (additive).
import { SUPPORT_POSTER, originalListings } from '@/lib/originalListing.mjs';

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
  // ORIGINAL (commented out 2026-10-03): return NextResponse.json({ posts: data });
  // NOTE: imported jobs and X posts (by support@revlo.ng) get original_url / original_kind for the admin.
  const originals = await originalListings((data || []).filter(p => p.poster_email === SUPPORT_POSTER).map(p => p.uid)).catch(() => ({}));
  return NextResponse.json({ posts: (data || []).map(p => (originals[p.uid] ? { ...p, original_url: originals[p.uid].url, original_kind: originals[p.uid].kind } : p)) });
}
