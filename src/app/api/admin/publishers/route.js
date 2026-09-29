import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { isEmail } from '@/lib/util';
import { changePublisherBadge, publisherSummary } from '@/lib/adminPublishers';

export const dynamic = 'force-dynamic';

// GET /api/admin/publishers?email=  -> posts, earned badge and any override.
export async function GET(request) {
  if (!await getAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const email = new URL(request.url).searchParams.get('email');
  if (!isEmail(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  return NextResponse.json({ publisher: await publisherSummary(email) });
}

// POST /api/admin/publishers { email, action: 'award' | 'remove' | 'restore', badge?, reason? }
// Every change emails the publisher with the Revlo template.
export async function POST(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!isEmail(body.email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  let override;
  if (body.action === 'award') {
    if (!['silver', 'bronze', 'gold'].includes(body.badge)) return NextResponse.json({ error: 'Choose Silver, Bronze or Gold.' }, { status: 400 });
    override = body.badge;
  } else if (body.action === 'remove') {
    override = 'none';
  } else if (body.action === 'restore') {
    override = null;
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await changePublisherBadge({ email: body.email, override, reason, admin }));
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not change the badge.' }, { status: 500 });
  }
}
