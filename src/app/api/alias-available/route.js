import { NextResponse } from 'next/server';
import { aliasTakenByOther, cleanAlias } from '@/lib/community';
import { isEmail } from '@/lib/util';
import { requestIp } from '@/lib/revloBlocklist';
import { requireRateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

// GET /api/alias-available?alias=Billy&email=me@x.com -> { available, error? }
// Aliases are public on posts, so this reveals nothing private.
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const limited = await requireRateLimit({ action: 'alias-available:ip:15m', key: requestIp(request), limit: 60, windowSeconds: 900 });
  if (limited) return limited;
  const alias = cleanAlias(params.get('alias'));
  if (alias.error) return NextResponse.json({ available: false, error: alias.error });
  if (!alias.value) return NextResponse.json({ available: true });
  const email = isEmail(params.get('email')) ? params.get('email') : '';
  const taken = await aliasTakenByOther(alias.value, email);
  return NextResponse.json({ available: !taken, error: taken ? `"${alias.value}" is already taken.` : undefined });
}
