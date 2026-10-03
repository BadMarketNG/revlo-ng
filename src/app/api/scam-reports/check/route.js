// Check an email or number (2026-10-03): how many reports about it our team has confirmed. Matched by
// hash only; reported details and reporters are never shown. Rate-limited.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRateLimit } from '@/lib/security';
import { requestIp } from '@/lib/revloBlocklist';
import { lookupHashes } from '@/lib/scamReports.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const limited = await requireRateLimit({ action: 'scam-check:ip', key: requestIp(request), limit: 30, windowSeconds: 600 });
  if (limited) return limited;
  const hashes = lookupHashes(request.nextUrl.searchParams.get('q') || '');
  if (!hashes.length) return NextResponse.json({ error: 'Enter a full email address, or a phone number with its country code.' }, { status: 400 });
  const list = hashes.join(',');
  const { data, error } = await supabaseAdmin.from('revlo_scam_reports').select('reviewed_at')
    .eq('status', 'confirmed').or(`subject_email_hash.in.(${list}),subject_phone_hash.in.(${list})`).order('reviewed_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: 'Check failed. Please try again.' }, { status: 500 });
  return NextResponse.json({ count: data?.length ?? 0, latest: data?.[0]?.reviewed_at ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
