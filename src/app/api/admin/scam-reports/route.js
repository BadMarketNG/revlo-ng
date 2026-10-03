// Admin: scam contact reports (2026-10-03). GET lists confirmed-by-reporter reports for review (with
// signed screenshot links); POST { id, action: 'confirm' | 'dismiss' }. Confirming blocks the reported
// email address from posting or contacting anyone on Revlo for 90 days.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminRequest } from '@/lib/adminAuth';
import { addAutomaticBlocks } from '@/lib/revloBlocklist';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const status = ['pending', 'confirmed', 'dismissed'].includes(request.nextUrl.searchParams.get('status')) ? request.nextUrl.searchParams.get('status') : 'pending';
  const { data, error } = await supabaseAdmin.from('revlo_scam_reports')
    .select('id,reporter_email,contact_method,scam_type,subject_email,subject_phone,subject_handle,post_uid,details,money_lost,currency,attachments,status,created_at,confirmed_at,reviewed_at')
    .eq('status', status).order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
  const reports = [];
  for (const r of data || []) {
    let evidence = [];
    if (r.attachments?.length) {
      const { data: signed } = await supabaseAdmin.storage.from('report-evidence').createSignedUrls(r.attachments, 300);
      evidence = (signed || []).filter(s => s.signedUrl).map(s => s.signedUrl);
    }
    // Earlier confirmed reports about the same email or number help the review.
    const { count } = await supabaseAdmin.from('revlo_scam_reports').select('id', { count: 'exact', head: true }).eq('status', 'confirmed')
      .or([r.subject_email ? `subject_email.eq.${r.subject_email}` : null, r.subject_phone ? `subject_phone.eq.${r.subject_phone}` : null].filter(Boolean).join(',') || 'id.is.null');
    reports.push({ ...r, attachments: undefined, evidence, previousConfirmed: count || 0 });
  }
  return NextResponse.json({ reports });
}

export async function POST(request) {
  if (!await isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = body.action === 'confirm' ? 'confirmed' : body.action === 'dismiss' ? 'dismissed' : null;
  if (!action || !/^[0-9a-f-]{36}$/.test(String(body.id || ''))) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  const { data: report } = await supabaseAdmin.from('revlo_scam_reports').update({ status: action, reviewed_at: new Date().toISOString() })
    .eq('id', body.id).in('status', ['pending', 'confirmed', 'dismissed']).select('subject_email').maybeSingle();
  if (!report) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (action === 'confirmed' && report.subject_email) {
    await addAutomaticBlocks({ email: report.subject_email, ip: null, reason: 'Confirmed scam contact report', source: 'scam_report', durationMs: 90 * 86400000 });
  }
  return NextResponse.json({ ok: true });
}
