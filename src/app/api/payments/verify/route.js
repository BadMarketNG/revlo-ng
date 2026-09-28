import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/util';
import { fulfilPayment } from '@/lib/revloPayments';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const claim = verifyToken(body.publish_token);
  if (!claim || claim.action !== 'publish' || !body.reference) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: intent } = await supabaseAdmin.from('revlo_payment_intents').select('email').eq('reference', body.reference).maybeSingle();
  if (!intent || intent.email !== claim.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const fulfilled = await fulfilPayment(body.reference);
    return NextResponse.json({ paid: fulfilled.status === 'paid', kind: fulfilled.kind, reference: body.reference });
  } catch (error) {
    return NextResponse.json({ paid: false, error: error.message }, { status: 402 });
  }
}
