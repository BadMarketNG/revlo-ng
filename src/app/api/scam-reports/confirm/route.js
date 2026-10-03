// Report a scam contact (2026-10-03): the reporter's confirmation link sends the report to review.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const back = state => NextResponse.redirect(`https://revlo.ng/app.html?scam=${state}`, 303);
  if (!/^[\w-]{20,64}$/.test(token)) return back('invalid');
  const { data } = await supabaseAdmin.from('revlo_scam_reports').update({ status: 'pending', confirmed_at: new Date().toISOString() })
    .eq('token', token).eq('status', 'unconfirmed').gt('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).select('id').maybeSingle();
  return back(data ? 'sent' : 'done');
}
