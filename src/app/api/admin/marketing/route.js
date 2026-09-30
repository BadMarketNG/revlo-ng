import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isEmail } from '@/lib/util';
import { AUDIENCES, audienceCounts, previewCampaign, sendNextBatch, sendTest, startCampaign } from '@/lib/marketing';

export const dynamic = 'force-dynamic';

// GET /api/admin/marketing -> campaigns and audience sizes (after exclusions).
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const [{ data: campaigns }, counts] = await Promise.all([
    supabaseAdmin.from('revlo_campaigns').select('*').order('created_at', { ascending: false }).limit(50),
    audienceCounts().catch(() => ({})),
  ]);
  return NextResponse.json({ campaigns: campaigns || [], counts, audiences: AUDIENCES });
}

function readDraft(body) {
  const subject = String(body.subject || '').trim();
  const preheader = String(body.preheader || '').trim() || null;
  const mode = body.mode === 'html' ? 'html' : 'text';
  const text = String(body.body || '');
  const audience = Object.hasOwn(AUDIENCES, body.audience) ? body.audience : null;
  if (!subject || subject.length > 150) return { error: 'Add a subject of up to 150 characters.' };
  if (preheader && preheader.length > 200) return { error: 'Keep the preview line to 200 characters.' };
  if (!text.trim()) return { error: 'Write the email first.' };
  if (text.length > 200000) return { error: 'The email is too long.' };
  if (!audience) return { error: 'Choose who receives it.' };
  return { value: { subject, preheader, mode, body: text, audience } };
}

// POST /api/admin/marketing { action, ... }
//   preview  { subject, preheader, mode, body }         -> { html, removed }
//   save     { id?, subject, preheader, mode, body, audience } -> { campaign }
//   test     { id, to }                                 -> { ok }
//   start    { id }                                     -> { total }
//   batch    { id }                                     -> { done, campaign }
//   cancel   { id }
export async function POST(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const adminName = admin.email || admin.sub || null;
  try {
    if (body.action === 'preview') return NextResponse.json(previewCampaign(body));

    if (body.action === 'save') {
      const draft = readDraft(body);
      if (draft.error) return NextResponse.json({ error: draft.error }, { status: 400 });
      if (body.id) {
        const { data, error } = await supabaseAdmin.from('revlo_campaigns').update(draft.value).eq('id', body.id).eq('status', 'draft').select('*').maybeSingle();
        if (error || !data) return NextResponse.json({ error: 'Only drafts can be edited.' }, { status: 409 });
        return NextResponse.json({ campaign: data });
      }
      const { data, error } = await supabaseAdmin.from('revlo_campaigns').insert({ ...draft.value, created_by: adminName }).select('*').single();
      if (error) throw new Error('Could not save the draft.');
      return NextResponse.json({ campaign: data });
    }

    const { data: campaign } = body.id ? await supabaseAdmin.from('revlo_campaigns').select('*').eq('id', body.id).maybeSingle() : { data: null };
    if (!campaign) return NextResponse.json({ error: 'Save the campaign first.' }, { status: 400 });

    if (body.action === 'test') {
      if (!isEmail(body.to)) return NextResponse.json({ error: 'Enter the email address for the test.' }, { status: 400 });
      const result = await sendTest(campaign, body.to);
      if (!result?.ok) return NextResponse.json({ error: result?.skipped ? 'Email sending is not configured here.' : `The test failed: ${result?.error || 'unknown error'}` }, { status: 502 });
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'start') {
      const total = await startCampaign(campaign.id);
      await supabaseAdmin.from('admin_log').insert({ action: 'marketing_campaign_start', target_uid: `campaign:${campaign.id}`, detail: { subject: campaign.subject, audience: campaign.audience, total, administrator: adminName } });
      return NextResponse.json({ total });
    }
    if (body.action === 'batch') return NextResponse.json(await sendNextBatch(campaign.id));
    if (body.action === 'cancel') {
      await supabaseAdmin.from('revlo_campaigns').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('id', campaign.id).in('status', ['draft', 'sending']);
      await supabaseAdmin.from('revlo_campaign_recipients').update({ status: 'skipped', error: 'cancelled' }).eq('campaign_id', campaign.id).eq('status', 'pending');
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Something went wrong.' }, { status: 500 });
  }
}
