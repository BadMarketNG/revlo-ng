import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getHomepageCopy } from '@/lib/homepageCopy.mjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getHomepageCopy(supabaseAdmin), {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  });
}
