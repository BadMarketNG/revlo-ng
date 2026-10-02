// Alert me (2026-10-02): one-click unsubscribe (GET from the email link, POST from mail apps).
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function unsubscribe(request) {
  const token = new URL(request.url).searchParams.get('token') || '';
  if (/^[\w-]{20,64}$/.test(token)) {
    await supabaseAdmin.from('revlo_alerts').update({ unsubscribed_at: new Date().toISOString() }).eq('token', token).is('unsubscribed_at', null);
  }
}

export async function GET(request) {
  await unsubscribe(request);
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed — Revlo.ng</title><body style="font-family:system-ui,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#1a1a1a"><h1 style="color:#1b5e20">You are unsubscribed</h1><p>You will not get this alert again.</p><p><a href="https://revlo.ng/app.html" style="color:#1b5e20;font-weight:700">Back to Revlo.ng</a></p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function POST(request) {
  await unsubscribe(request);
  return new Response(null, { status: 204 });
}
