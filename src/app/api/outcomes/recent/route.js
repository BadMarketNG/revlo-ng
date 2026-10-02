// Results (2026-10-02): recent results the posters agreed to share, for the "Recently gone" strip.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { headline } from '@/lib/outcomes.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data } = await supabaseAdmin.from('revlo_outcomes').select('id,outcome,label,hours,resolved_at').eq('share', true)
    .gt('resolved_at', new Date(Date.now() - 14 * 86400000).toISOString()).order('resolved_at', { ascending: false }).limit(12);
  return NextResponse.json({ results: (data ?? []).map(r => ({ id: r.id, text: headline(r.outcome, Number(r.hours)), label: r.label })) },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
}
