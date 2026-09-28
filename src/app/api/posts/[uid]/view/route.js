import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const UID_PATTERN = /^[A-Z0-9-]{4,40}$/i;
const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request, { params }) {
  const uid = typeof params?.uid === 'string' ? params.uid.trim() : '';
  const body = await request.json().catch(() => null);
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';

  if (!UID_PATTERN.test(uid) || !SESSION_PATTERN.test(sessionId) || body?.completed !== true) {
    return NextResponse.json({ error: 'invalid view' }, { status: 422 });
  }

  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  }

  const sourceIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const limited = await requireRateLimit({
    action: 'post-view:hour',
    key: sourceIp,
    limit: 500,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  const { data, error } = await supabaseAdmin.rpc('record_revlo_post_session_view', {
    p_uid: uid,
    p_session_id: sessionId,
  });

  if (error) {
    console.error('[post:view]', error.code || error.message);
    return NextResponse.json({ error: 'view unavailable' }, { status: 503 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result || result.view_count === null) {
    return NextResponse.json({ error: 'not found or expired' }, { status: 404 });
  }

  return NextResponse.json(
    { counted: result.counted === true, views: Number(result.view_count) || 0 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
