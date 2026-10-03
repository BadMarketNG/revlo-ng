// X feed refresh (2026-10-03, additive). Every 6 hours; the work is in src/lib/xFeedRun.mjs (also used by
// the admin "Run now" button). Searches and budget come from the admin X feed tab, falling back to the
// Vercel environment values.
import { NextResponse } from 'next/server';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { runXFeed } from '@/lib/xFeedRun.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch { return NextResponse.json({ error: 'service unavailable' }, { status: 503 }); }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runXFeed()) });
}
