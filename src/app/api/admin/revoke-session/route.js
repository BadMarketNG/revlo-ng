import { NextResponse } from 'next/server';
import { serviceSecretMatches } from '@/lib/adminSso';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!serviceSecretMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const administratorId = typeof body?.sub === 'string' ? body.sub.trim() : '';
  if (!administratorId || administratorId.length > 200) {
    return NextResponse.json({ error: 'invalid administrator' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('revlo_admin_session_revocations').upsert({
    administrator_id: administratorId,
    revoked_after: now,
    updated_at: now,
  }, { onConflict: 'administrator_id' });
  if (error) return NextResponse.json({ error: 'revocation unavailable' }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
