import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// GET /api/unfollow?email=...&poster=...  (one-click unsubscribe from emails)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = (searchParams.get('email') || '').trim().toLowerCase();
  const poster = (searchParams.get('poster') || '').trim().toLowerCase();

  if (!email || !poster) {
    return NextResponse.json({ error: 'email and poster required' }, { status: 400 });
  }

  await supabaseAdmin
    .from('follows')
    .delete()
    .eq('follower_email', email)
    .eq('poster_email', poster);

  return new NextResponse(
    `<html><body style="font-family:sans-serif;text-align:center;padding:40px">
       <h2>Unsubscribed</h2>
       <p>You will no longer receive emails about this poster.</p>
     </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}

// POST variant for List-Unsubscribe-Post one-click
export async function POST(request) {
  return GET(request);
}
