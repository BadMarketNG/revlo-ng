import { NextResponse } from 'next/server';
import { isIP } from 'node:net';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';

export const dynamic = 'force-dynamic';

async function sessionOrResponse() {
  const session = await getAdminSession();
  return session || NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function GET() {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;
  const { data, error } = await supabaseAdmin
    .from('revlo_access_blocks')
    .select('id,block_type,value,reason,source,expires_at,created_by,created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'failed to load block list' }, { status: 500 });
  return NextResponse.json({ blocks: data || [] }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null);
  const blockType = body?.block_type;
  const value = typeof body?.value === 'string' ? body.value.trim().toLowerCase() : '';
  const reason = typeof body?.reason === 'string' && body.reason.trim()
    ? body.reason.trim().slice(0, 500)
    : 'Manual administrator block';
  if (!['email', 'ip'].includes(blockType)) return NextResponse.json({ error: 'invalid block type' }, { status: 400 });
  if (blockType === 'email' && !isEmail(value)) return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  if (blockType === 'ip' && !isIP(value)) return NextResponse.json({ error: 'valid IPv4 or IPv6 address required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('revlo_access_blocks').upsert({
    block_type: blockType,
    value,
    reason,
    source: 'manual',
    expires_at: null,
    created_by: session.email,
  }, { onConflict: 'block_type,value' });
  if (error) return NextResponse.json({ error: 'failed to add block' }, { status: 500 });
  await supabaseAdmin.from('admin_log').insert({ action: `block_${blockType}`, target_uid: value, detail: { reason } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const session = await sessionOrResponse();
  if (session instanceof NextResponse) return session;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { data: record } = await supabaseAdmin.from('revlo_access_blocks').select('block_type,value').eq('id', id).maybeSingle();
  const { error } = await supabaseAdmin.from('revlo_access_blocks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'failed to remove block' }, { status: 500 });
  if (record) await supabaseAdmin.from('admin_log').insert({ action: `unblock_${record.block_type}`, target_uid: record.value, detail: {} });
  return NextResponse.json({ ok: true });
}
