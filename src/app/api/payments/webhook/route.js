import { NextResponse } from 'next/server';
import { validWebhookSignature } from '@/lib/paystack';
import { fulfilPayment } from '@/lib/revloPayments';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const raw = await request.text();
  if (!validWebhookSignature(raw, request.headers.get('x-paystack-signature'))) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  let event;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (event.event === 'charge.success' && event.data?.reference) {
    try { await fulfilPayment(event.data.reference, event.data); } catch (error) { console.error('[paystack:webhook]', error); }
  }
  return NextResponse.json({ ok: true });
}
