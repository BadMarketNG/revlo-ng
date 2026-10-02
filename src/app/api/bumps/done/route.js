// Bump up (2026-10-02): Paystack sends the payer back here; verify and apply (the webhook does too).
import { NextResponse } from 'next/server';
import { fulfilPayment } from '@/lib/revloPayments';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const reference = new URL(request.url).searchParams.get('reference') || '';
  if (!/^revlo-bump-\d+-[0-9a-f]{16}$/.test(reference)) return NextResponse.redirect('https://revlo.ng/app.html?bump=failed', 303);
  try {
    const intent = await fulfilPayment(reference);
    return NextResponse.redirect(`https://revlo.ng/app.html?bump=${intent.status === 'paid' ? 'done' : 'pending'}`, 303);
  } catch {
    return NextResponse.redirect('https://revlo.ng/app.html?bump=failed', 303);
  }
}
