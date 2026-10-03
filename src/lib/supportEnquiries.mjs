// Support enquiries (2026-10-03): Contact messages on support@revlo.ng posts (imported jobs and X posts).
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { publicOrigin } from '@/lib/publicOrigin';
import { SUPPORT_POSTER, originalListings } from '@/lib/originalListing.mjs';

const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Records the enquiry and returns the internal HTML block for support's email ('' for other posters). */
export async function supportEnquiryNote(post, pending) {
  if (String(post?.poster_email || '').toLowerCase() !== SUPPORT_POSTER) return '';
  try {
    await supabaseAdmin.from('revlo_support_enquiries').insert({ post_uid: post.uid, post_title: post.title, from_email: pending.email, message: pending.message });
    const original = (await originalListings([post.uid]))[post.uid];
    const admin = `${publicOrigin()}/revlongbm?tab=enquiries`;
    const link = original ? `<p><strong>Original listing:</strong> <a href="${esc(original.url)}">${esc(original.url)}</a></p>` : '<p>No original listing is recorded for this post.</p>';
    return `<hr><div style="background:#fff7e6;border:1px solid #f3dfb0;border-radius:8px;padding:10px 12px">
      <p style="margin:0 0 6px"><strong>Internal (support only, do not forward):</strong></p>${link}
      <p style="margin:6px 0 0">Send the applicant the <strong>employer's own</strong> application page or email, never the listing link above. Reply from the admin: <a href="${esc(admin)}">Enquiries</a>.</p></div>`;
  } catch {
    return '';
  }
}
