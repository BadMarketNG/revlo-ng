import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail } from '@/lib/email';
import { wrapEmail } from '@/lib/emailTemplate';
import { isEmail } from '@/lib/util';
import { publicOrigin } from '@/lib/publicOrigin';
import { getFeatureSettings } from '@/lib/revloFeatures';
import { liftSuspension, suspendEmail } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// GET /api/admin/moderation -> posts flagged for contact details, active suspensions
export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const now = new Date().toISOString();
  const [{ data: flags }, { data: suspensions }, settings] = await Promise.all([
    supabaseAdmin.from('revlo_post_flags').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('revlo_suspensions').select('*').is('lifted_at', null).gt('until', now).order('until', { ascending: true }).limit(500),
    getFeatureSettings(),
  ]);
  const uids = (flags || []).map((f) => f.post_uid);
  const { data: posts } = uids.length ? await supabaseAdmin.from('posts').select('uid,title,description,location,tags,created_at,deleted_at').in('uid', uids) : { data: [] };
  const byUid = new Map((posts || []).map((p) => [p.uid, p]));
  return NextResponse.json({
    flags: (flags || []).map((f) => ({ ...f, post: byUid.get(f.post_uid) || null })),
    suspensions: suspensions || [],
    defaultDays: settings.suspension_default_days,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST { action: 'remove_post' | 'dismiss', flagId } | { action: 'suspend', email, days, reason } | { action: 'lift', email }
export async function POST(request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const adminName = admin.email || admin.sub || null;
  try {
    if (body.action === 'suspend') {
      if (!isEmail(body.email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
      const days = Math.floor(Number(body.days));
      if (!Number.isFinite(days) || days < 1 || days > 3650) return NextResponse.json({ error: 'Suspend for 1 to 3,650 days.' }, { status: 400 });
      const result = await suspendEmail({ email: body.email, days, reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null, admin });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === 'lift') {
      if (!isEmail(body.email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
      return NextResponse.json({ ok: true, lifted: await liftSuspension({ email: body.email, admin }) });
    }

    const { data: flag } = await supabaseAdmin.from('revlo_post_flags').select('*').eq('id', Number(body.flagId)).maybeSingle();
    if (!flag) return NextResponse.json({ error: 'Flag not found.' }, { status: 404 });
    if (body.action === 'dismiss') {
      await supabaseAdmin.from('revlo_post_flags').update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: adminName }).eq('id', flag.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'remove_post') {
      const { data: post } = await supabaseAdmin.from('posts').update({ deleted_at: new Date().toISOString() }).eq('uid', flag.post_uid).is('deleted_at', null).select('uid,title').maybeSingle();
      await supabaseAdmin.from('revlo_post_flags').update({ status: 'removed', resolved_at: new Date().toISOString(), resolved_by: adminName }).eq('id', flag.id);
      await supabaseAdmin.from('admin_log').insert({ action: 'post_removed_contact_details', target_uid: flag.post_uid, detail: { matches: flag.matches, administrator: adminName } });
      if (post) {
        await sendEmail({
          to: flag.poster_email,
          subject: 'Your Revlo.ng post was removed',
          html: wrapEmail(`<p>Your post <strong>${escapeHtml(post.title)}</strong> (${post.uid}) was removed because it included contact details, such as a phone number, email address, link or social media handle.</p><p>Contact details are not allowed in Revlo posts. People reach you through Revlo's verified Contact button, which keeps your details private and protects everyone from scams.</p><p>You are welcome to post again without contact details.</p><p><a href="${publicOrigin()}/rules">Read the Revlo rules</a></p>`),
          headers: { 'Reply-To': 'support@revlo.ng' },
        });
      }
      return NextResponse.json({ ok: true, removed: Boolean(post) });
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Something went wrong.' }, { status: 500 });
  }
}
