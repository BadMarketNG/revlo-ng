import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// Revlo email log (2026-10-01).
// GET  ?status=&q=&from=&to=&sort=newest|oldest&page=&format=csv
// DELETE { ids } or { filter, confirm: true }
const PAGE_SIZE = 50;
const EXPORT_LIMIT = 20000;

function applyFilters(query, params) {
  if (['sent', 'failed', 'skipped'].includes(params.status)) query = query.eq('status', params.status);
  const q = String(params.q || '').trim().slice(0, 100);
  if (q) {
    const like = `%${q.replace(/[\\%_,()]/g, (c) => `\\${c}`)}%`;
    query = query.or(`to_email.ilike.${like},subject.ilike.${like}`);
  }
  if (params.from && !Number.isNaN(Date.parse(params.from))) query = query.gte('created_at', new Date(params.from).toISOString());
  if (params.to && !Number.isNaN(Date.parse(params.to))) query = query.lte('created_at', new Date(new Date(params.to).getTime() + 86399999).toISOString());
  return query;
}

const csvCell = (value) => {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export async function GET(request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const params = { status: sp.get('status'), q: sp.get('q'), from: sp.get('from'), to: sp.get('to') };
  const ascending = sp.get('sort') === 'oldest';
  if (sp.get('format') === 'csv') {
    const { data, error } = await applyFilters(supabaseAdmin.from('revlo_email_log').select('created_at,to_email,subject,status,error,message_id'), params).order('created_at', { ascending }).limit(EXPORT_LIMIT);
    if (error) return NextResponse.json({ error: 'Could not export the log.' }, { status: 500 });
    const rows = [['sent_at', 'to', 'subject', 'status', 'error', 'message_id'], ...(data || []).map((r) => [r.created_at, r.to_email, r.subject, r.status, r.error, r.message_id])];
    return new NextResponse(rows.map((row) => row.map(csvCell).join(',')).join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="revlo-email-log-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' },
    });
  }
  const page = Math.max(1, Math.min(1000, Number(sp.get('page')) || 1));
  const { data, count, error } = await applyFilters(supabaseAdmin.from('revlo_email_log').select('*', { count: 'exact' }), params)
    .order('created_at', { ascending }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) return NextResponse.json({ error: 'Could not load the log.' }, { status: 500 });
  return NextResponse.json({ rows: data || [], total: count || 0, page, pageSize: PAGE_SIZE });
}

export async function DELETE(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  let query = null;
  if (Array.isArray(body.ids)) {
    const ids = body.ids.map(Number).filter((id) => Number.isInteger(id) && id > 0).slice(0, 1000);
    if (!ids.length) return NextResponse.json({ error: 'Choose entries to delete.' }, { status: 400 });
    query = supabaseAdmin.from('revlo_email_log').delete().in('id', ids);
  } else if (body.confirm === true && body.filter && typeof body.filter === 'object') {
    query = applyFilters(supabaseAdmin.from('revlo_email_log').delete(), body.filter);
  } else {
    return NextResponse.json({ error: 'Nothing to delete.' }, { status: 400 });
  }
  const { data, error } = await query.select('id');
  if (error) return NextResponse.json({ error: 'Could not delete.' }, { status: 500 });
  await supabaseAdmin.from('admin_log').insert({ action: 'email_log_deleted', target_uid: 'email_log', detail: { deleted: data?.length || 0, mode: Array.isArray(body.ids) ? 'selected' : 'filter', administrator: admin.email || admin.sub || null } });
  return NextResponse.json({ deleted: data?.length || 0 });
}
