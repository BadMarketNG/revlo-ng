import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/util';
import { getPublisherStatus } from '@/lib/revloFeatures';
import { findActiveBlock, requestIp } from '@/lib/revloBlocklist';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const claim = verifyToken(token);
  if (!claim || claim.action !== 'publish') return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await findActiveBlock({ email: claim.email, ip: requestIp(request) })) {
    return NextResponse.json({ error: 'unavailable' }, { status: 403 });
  }
  return NextResponse.json({ status: await getPublisherStatus(claim.email) });
}
