import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { isEmail } from '@/lib/util';
import { sendAdminMessage } from '@/lib/adminPublishers';

export const dynamic = 'force-dynamic';

// POST /api/admin/send-email { to, subject, message } -> emails a user with the
// Revlo template. Administrator only; every message is logged.
export async function POST(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!isEmail(body.to)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (subject.length < 2 || subject.length > 120) return NextResponse.json({ error: 'Subject must be 2 to 120 characters.' }, { status: 400 });
  if (message.length < 2 || message.length > 5000) return NextResponse.json({ error: 'Message must be 2 to 5,000 characters.' }, { status: 400 });
  const result = await sendAdminMessage({ to: body.to, subject, message, admin });
  if (!result.emailSent) return NextResponse.json({ error: result.skipped ? 'Email is not configured on this server.' : 'The email could not be sent. Try again shortly.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
