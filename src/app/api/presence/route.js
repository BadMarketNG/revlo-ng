import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const visitorId = typeof body?.visitorId === 'string' ? body.visitorId.trim() : '';
  const path = typeof body?.path === 'string' && body.path.startsWith('/') ? body.path.slice(0, 240) : '/';
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(visitorId)) {
    return NextResponse.json({ error: 'invalid presence' }, { status: 422 });
  }
  const { error } = await supabaseAdmin.from('public_visitor_presence').upsert({
    visitor_id: visitorId,
    path,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'visitor_id' });
  if (error) return NextResponse.json({ error: 'presence unavailable' }, { status: 503 });
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
