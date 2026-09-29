import { NextResponse } from 'next/server';
import { isEmail } from '@/lib/util';
import { normaliseEmail, requestIp } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';
import { NORMAL_LINK_MINUTES, getPublisherStatus, publishLinkAllowance } from '@/lib/revloFeatures';

export const dynamic = 'force-dynamic';

// GET /api/publish-allowance?email=... -> how many posts one emailed publish
// link allows for this email (by badge), and whether it has a time limit.
// Badges are already public on posts, so this reveals nothing new; it is
// rate limited per network to stop bulk lookups.
export async function GET(request) {
  const email = new URL(request.url).searchParams.get('email');
  if (!isEmail(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const limited = await requireRateLimit({ action: 'publish-allowance:ip:15m', key: requestIp(request), limit: 20, windowSeconds: 900 });
  if (limited) return limited;
  try {
    const status = await getPublisherStatus(normaliseEmail(email));
    const postsPerLink = publishLinkAllowance(status.trustBadge);
    const response = NextResponse.json({
      badge: status.trustBadge,
      postsPerLink,
      timeLimitMinutes: postsPerLink > 1 ? null : NORMAL_LINK_MINUTES,
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'Could not check right now. Try again shortly.' }, { status: 503 });
  }
}
