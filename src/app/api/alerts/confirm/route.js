// Alert me (2026-10-02): the confirmation link activates the alert.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[\w-]{20,64}$/.test(token)) return NextResponse.redirect('https://revlo.ng/app.html?alert=invalid', 303);
  const { data } = await supabaseAdmin.from('revlo_alerts')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('token', token).is('confirmed_at', null).is('unsubscribed_at', null).select('id').maybeSingle();
  return NextResponse.redirect(`https://revlo.ng/app.html?alert=${data ? 'confirmed' : 'done'}`, 303);
}
