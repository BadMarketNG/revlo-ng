// Results (2026-10-02): the signed "mark as gone" link emailed to a post's own address.
import { signToken } from '@/lib/util';
import { esc } from './bookingPages.mjs';
import { outcomeFor } from './outcomes.mjs';

export function markLink(post) {
  const token = signToken({ action: 'outcome', uid: post.uid, email: String(post.poster_email).toLowerCase() }, 7 * 86400000);
  return `https://revlo.ng/api/outcomes/mark?token=${encodeURIComponent(token)}`;
}

export function markEmail(post, { prompt = false } = {}) {
  const { verb } = outcomeFor(post.category);
  const link = markLink(post);
  return {
    subject: (prompt ? `Did it go? ${post.title}` : `Mark your Revlo post as ${verb.toLowerCase()}: ${post.title}`).slice(0, 150),
    html: `<p>${prompt ? 'Quick question about your Revlo.ng post' : 'Here is the link to update your Revlo.ng post'} <strong>${esc(post.title)}</strong>.</p>
           <p><a href="${link}">${verb} already? Tap here</a> and we will stop new enquiries for it.</p>
           <p style="color:#888;font-size:13px">If it is still available, ignore this email. The link works for 7 days.</p>`,
  };
}
