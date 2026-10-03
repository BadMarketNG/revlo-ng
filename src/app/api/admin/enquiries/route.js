// Admin: support enquiries (2026-10-03). GET: recent Contact messages on support@revlo.ng posts with the
// original listing. POST { id, apply_link, message }: emails the applicant the employer's own application
// link. Links to the private job sources are refused so the source is never revealed.
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { originalListings, revealsSource } from '@/lib/originalListing.mjs';
import { isEmail } from '@/lib/util';

export const dynamic = 'force-dynamic';
const deny = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });
const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(request) {
  if (!await isAdminRequest()) return deny();
  const status = new URL(request.url).searchParams.get('status') === 'replied' ? 'replied' : 'open';
  let query = supabaseAdmin.from('revlo_support_enquiries').select('*').order('created_at', { ascending: false }).limit(200);
  query = status === 'replied' ? query.not('replied_at', 'is', null) : query.is('replied_at', null);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Could not load enquiries.' }, { status: 500 });
  const originals = await originalListings((data || []).map(e => e.post_uid));
  return NextResponse.json({ enquiries: (data || []).map(e => ({ ...e, original: originals[e.post_uid] || null })) });
}

export async function POST(request) {
  if (!await isAdminRequest()) return deny();
  const body = await request.json().catch(() => ({}));
  const { data: enquiry } = await supabaseAdmin.from('revlo_support_enquiries').select('*').eq('id', String(body.id || '')).maybeSingle();
  if (!enquiry) return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 });
  const applyLink = String(body.apply_link || '').trim();
  const note = String(body.message || '').trim().slice(0, 2000);
  const linkIsUrl = /^https:\/\/[^\s]+$/i.test(applyLink);
  if (!linkIsUrl && !isEmail(applyLink)) return NextResponse.json({ error: "Add the employer's application page (https://…) or email address." }, { status: 400 });
  const original = (await originalListings([enquiry.post_uid]))[enquiry.post_uid];
  // X links are fine to share; an imported job's listing site must never reach the applicant.
  const privateHosts = original?.kind === 'job' ? [original.host] : [];
  if (revealsSource(`${applyLink} ${note}`, privateHosts)) {
    return NextResponse.json({ error: "That link or message points to where the job was found. Open it, find the employer's own page or email, and send that instead." }, { status: 400 });
  }
  const how = linkIsUrl
    ? `<p><a href="${esc(applyLink)}" style="display:inline-block;background:#1b5e20;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">Apply here</a></p><p style="font-size:13px;color:#555">${esc(applyLink)}</p>`
    : `<p>Apply by email to <a href="mailto:${esc(applyLink)}">${esc(applyLink)}</a>.</p>`;
  const result = await sendEmail({
    to: enquiry.from_email,
    subject: `Revlo.ng: how to apply for "${enquiry.post_title || 'the post'}"`,
    html: `<p>Thanks for your message about <strong>${esc(enquiry.post_title)}</strong> on Revlo.ng.</p>${how}${note ? `<p>${esc(note).replace(/\n/g, '<br>')}</p>` : ''}
           <p style="font-size:13px;color:#555">Never pay anyone to apply for a job. If anyone asks for money, report them at revlo.ng/app.html?scam=report.</p>`,
    headers: { 'Reply-To': 'support@revlo.ng' },
  });
  if (result?.ok === false) return NextResponse.json({ error: 'The email could not be sent. Try again.' }, { status: 502 });
  await supabaseAdmin.from('revlo_support_enquiries').update({ replied_at: new Date().toISOString(), reply_link: applyLink }).eq('id', enquiry.id);
  return NextResponse.json({ ok: true });
}
