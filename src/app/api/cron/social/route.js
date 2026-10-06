import { NextResponse } from 'next/server';
import { constantTimeBearerMatches, requiredSecret } from '@/lib/security';
import { runSocialPublishing } from '@/lib/socialRun.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  let secret;
  try { secret = requiredSecret('CRON_SECRET'); } catch { return NextResponse.json({ error: 'service unavailable' }, { status: 503 }); }
  if (!constantTimeBearerMatches(request.headers.get('authorization') || '', secret)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const result = await runSocialPublishing();
    console.info('[cron:social]', JSON.stringify({ counts: result.counts, status: result.status, results: result.results }));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron:social]', error);
    return NextResponse.json({ error: 'social publishing failed' }, { status: 500 });
  }
}
