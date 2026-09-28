import crypto from 'crypto';

function secret() {
  const value = process.env.PAYSTACK_SECRET_KEY || '';
  if (!value.startsWith('sk_')) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return value;
}

export async function initializeTransaction({ email, amount, reference, callbackUrl, metadata }) {
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount, reference, callback_url: callbackUrl, metadata }),
    cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok || !body.status || !body.data?.authorization_url) throw new Error('Payment could not be started');
  return body.data;
}

export async function verifyTransaction(reference) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret()}` }, cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok || !body.status) throw new Error('Payment could not be verified');
  return body.data;
}

export function validWebhookSignature(rawBody, signature) {
  if (!signature) return false;
  const expected = crypto.createHmac('sha512', secret()).update(rawBody).digest('hex');
  try {
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}
