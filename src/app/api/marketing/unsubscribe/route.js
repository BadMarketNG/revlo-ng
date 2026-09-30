import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { readUnsubscribeToken } from '@/lib/marketing';

export const dynamic = 'force-dynamic';

const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title, body, status = 200) {
  return new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Revlo.ng</title></head>
<body style="margin:0;background:#f4efe1;font-family:system-ui,sans-serif;color:#1f2a22">
<div style="max-width:480px;margin:60px auto;padding:30px;background:#fff;border-radius:18px;border:1px solid #e6dcc3;text-align:center">
<div style="font-size:24px;font-weight:900;color:#123d17">revlo<span style="color:#f2b632">.</span>ng</div>
<h1 style="font-size:22px;margin:18px 0 10px">${title}</h1>${body}</div></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

// GET shows a confirm button, so link scanners that open emails do not
// unsubscribe people by accident. POST unsubscribes (also used by the
// one-click List-Unsubscribe header in mail apps).
export async function GET(request) {
  const token = request.nextUrl.searchParams.get('t') || '';
  const claim = readUnsubscribeToken(token);
  if (!claim) return page('Link not valid', '<p>This unsubscribe link is invalid or has expired. Reply to any Revlo email and we will remove you.</p>', 400);
  return page('Unsubscribe from news and offers?', `<p>We will stop sending news and offers to <strong>${escapeHtml(claim.email)}</strong>. You will still get emails you ask for, like publish links and follow alerts.</p>
<form method="post" action="/api/marketing/unsubscribe?t=${encodeURIComponent(token)}"><button style="margin-top:14px;background:#123d17;color:#fff;border:0;border-radius:10px;padding:13px 22px;font-weight:800;font-size:15px;cursor:pointer">Unsubscribe</button></form>`);
}

export async function POST(request) {
  const claim = readUnsubscribeToken(request.nextUrl.searchParams.get('t') || '');
  if (!claim) return page('Link not valid', '<p>This unsubscribe link is invalid or has expired.</p>', 400);
  await supabaseAdmin.from('revlo_marketing_unsubscribes').upsert({ email: claim.email, campaign_id: claim.c || null }, { onConflict: 'email', ignoreDuplicates: true });
  return page('You are unsubscribed', '<p>You will not receive news and offers from Revlo.ng again.</p>');
}
