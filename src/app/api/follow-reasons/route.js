import { NextResponse } from 'next/server';
import { reasonsForPosts } from '@/lib/community';
import { requestIp } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

// GET /api/follow-reasons?uids=RV-A,RV-B -> { reasons: { uid: { count, reasons: [{ text, at }] } } }
// Public notes followers left on why they follow the poster behind each post.
export async function GET(request) {
  const uids = [...new Set((new URL(request.url).searchParams.get('uids') || '').split(',').map((u) => u.trim()).filter((u) => /^[A-Za-z0-9-]{3,40}$/.test(u)))].slice(0, 50);
  if (!uids.length) return NextResponse.json({ reasons: {} });
  const limited = await requireRateLimit({ action: 'follow-reasons:ip:1m', key: requestIp(request), limit: 60, windowSeconds: 60 });
  if (limited) return limited;
  const response = NextResponse.json({ reasons: await reasonsForPosts(uids) });
  response.headers.set('Cache-Control', 'public, max-age=30');
  return response;
}
