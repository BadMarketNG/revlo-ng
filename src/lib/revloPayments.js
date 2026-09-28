import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyTransaction } from '@/lib/paystack';

export async function fulfilPayment(reference, suppliedTransaction = null) {
  const { data: intent, error } = await supabaseAdmin
    .from('revlo_payment_intents').select('*').eq('reference', reference).maybeSingle();
  if (error || !intent) throw new Error('Unknown payment reference');
  if (intent.status === 'paid' && intent.fulfilled_at) return intent;
  const transaction = suppliedTransaction || await verifyTransaction(reference);
  const paidAmount = Number(transaction.amount);
  const paidEmail = String(transaction.customer?.email || '').trim().toLowerCase();
  if (transaction.status !== 'success' || paidAmount !== intent.amount_kobo || paidEmail !== intent.email) {
    throw new Error('Payment details did not match');
  }
  if (intent.kind === 'premium') {
    const days = Number(intent.metadata?.premium_days || 30);
    const { data: completed, error: badgeError } = await supabaseAdmin.rpc('fulfil_revlo_premium_payment', {
      p_reference: reference, p_email: intent.email, p_days: days,
    });
    if (badgeError || !completed) throw badgeError || new Error('Payment could not be fulfilled');
    return { ...intent, status: 'paid', fulfilled_at: new Date().toISOString() };
  }
  const { data: fulfilled, error: fulfilError } = await supabaseAdmin.from('revlo_payment_intents').update({ status: 'paid' })
    .eq('reference', reference).eq('status', 'pending').select('*').maybeSingle();
  if (fulfilError) throw fulfilError;
  return fulfilled || intent;
}
