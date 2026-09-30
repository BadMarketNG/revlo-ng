import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';
import { BIAS, WEIGHTS, collusionDetail, collusionReport, deleteAllPosts, removeAllFollows, toCsv } from '@/lib/collusion';

export const dynamic = 'force-dynamic';

function csvResponse(csv, name) {
  return new NextResponse(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });
}

// GET /api/admin/collusion              -> ranked report
// GET /api/admin/collusion?poster=email -> one poster, followers grouped by IP
// add &format=csv to either to download it
export async function GET(request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const poster = params.get('poster');
  const csv = params.get('format') === 'csv';
  const stamp = new Date().toISOString().slice(0, 10);
  try {
    if (poster) {
      if (!isEmail(poster)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
      const detail = await collusionDetail(poster);
      if (csv) {
        const rows = [['ip_group', 'follower_email', 'followed_at', 'request_ip', 'confirm_ip', 'same_device_as_poster', 'same_ip_as_poster', 'single_purpose', 'follows_count', 'posts_count']];
        for (const group of detail.ipGroups) for (const f of group.followers) rows.push([group.ip, f.email, f.followedAt, f.requestIp, f.confirmIp, f.deviceMatch, f.ipMatch, f.singlePurpose, f.followsCount, f.postsCount]);
        return csvResponse(toCsv(rows), `revlo-collusion-${detail.poster}-${stamp}.csv`);
      }
      return NextResponse.json({ detail, weights: WEIGHTS, bias: BIAS });
    }
    const report = await collusionReport();
    if (csv) {
      const rows = [['poster_email', 'score', 'band', 'followers', 'posts', 'account_age_days', 'follow_span_hours', 'median_gap_minutes', 'D_device', 'I_ip', 'C_concentration', 'B_burst', 'S_single_purpose', 'V_velocity', 'Q_followers_per_post', 'A_youth']];
      for (const r of report) rows.push([r.poster, r.score, r.band, r.followers, r.posts, r.accountAgeDays, r.followSpanHours, r.medianGapMinutes, r.signals.D, r.signals.I, r.signals.C, r.signals.B, r.signals.S, r.signals.V, r.signals.Q, r.signals.A]);
      return csvResponse(toCsv(rows), `revlo-collusion-report-${stamp}.csv`);
    }
    return NextResponse.json({ report, weights: WEIGHTS, bias: BIAS });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not build the report.' }, { status: 500 });
  }
}

// POST /api/admin/collusion { poster, action: 'delete_posts' | 'remove_follows' }
export async function POST(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!isEmail(body.poster)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const poster = String(body.poster).trim().toLowerCase();
  try {
    let affected;
    if (body.action === 'delete_posts') affected = await deleteAllPosts(poster);
    else if (body.action === 'remove_follows') affected = await removeAllFollows(poster);
    else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    await supabaseAdmin.from('admin_log').insert({
      action: `collusion_${body.action}`,
      target_uid: `publisher:${poster}`,
      detail: { affected, reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null, administrator: admin.email || admin.sub || null },
    });
    return NextResponse.json({ ok: true, affected });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'The action failed.' }, { status: 500 });
  }
}
