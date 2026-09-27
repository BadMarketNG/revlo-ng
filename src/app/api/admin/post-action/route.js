import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';
import { expiryFor, isValidDuration, isValidCategory } from '@/lib/util';

export const dynamic = 'force-dynamic';

// POST /api/admin/post-action
// { uid, action: 'soft_delete' | 'restore' | 'change_duration', duration? }
export async function POST(request) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const { uid, action, duration, title, description, category } = body || {};
  if (!uid || !action) {
    return NextResponse.json({ error: 'uid and action required' }, { status: 400 });
  }

  let update = null;
  let detail = {};

  if (action === 'soft_delete') {
    update = { deleted_at: new Date().toISOString() };
  } else if (action === 'restore') {
    update = { deleted_at: null };
  } else if (action === 'change_duration') {
    if (!isValidDuration(duration)) {
      return NextResponse.json({ error: 'valid duration required' }, { status: 400 });
    }
    // Reset the clock: new expiry from now.
    update = { duration, expires_at: expiryFor(duration) };
    detail = { duration };
  } else if (action === 'edit') {
    update = {};
    if (typeof title === 'string' && title.trim().length >= 2) update.title = title.trim();
    if (typeof description === 'string') update.description = description.slice(0, 5000);
    if (category !== undefined) {
      if (!isValidCategory(category)) {
        return NextResponse.json({ error: 'invalid category' }, { status: 400 });
      }
      update.category = category;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }
    detail = update;
  } else if (action === 'hard_delete') {
    const { error: delError } = await supabaseAdmin.from('posts').delete().eq('uid', uid);
    if (delError) {
      console.error('[admin/post-action:hard_delete]', delError);
      return NextResponse.json({ error: 'failed' }, { status: 500 });
    }
    supabaseAdmin
      .from('admin_log')
      .insert({ action, target_uid: uid, detail: {} })
      .then(() => {})
      .catch(() => {});
    return NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('posts').update(update).eq('uid', uid);
  if (error) {
    console.error('[admin/post-action]', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }

  // Audit log (best-effort).
  supabaseAdmin
    .from('admin_log')
    .insert({ action, target_uid: uid, detail })
    .then(() => {})
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
