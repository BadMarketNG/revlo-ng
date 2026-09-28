import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('revlo_promotions')
    .select('id,post_uid,title,description,image_url,target_url,category,source,starts_at,ends_at,posts(uid,title,description,header_url,thumb_url,category,location)')
    .eq('active', true).lte('starts_at', now).gt('ends_at', now).order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
  return NextResponse.json({ promotions: data || [] });
}
