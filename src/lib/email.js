import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'Revlo.ng <noreply@revlo.ng>';

const resend = apiKey ? new Resend(apiKey) : null;

// Send an email. If Resend isn't configured (no key), we log and no-op so the
// app still works in development without email set up.
export async function sendEmail({ to, subject, html, headers }) {
  if (!resend) {
    console.log('[email:skipped] RESEND_API_KEY not set. Would send:', {
      to,
      subject,
    });
    return { skipped: true };
  }
  try {
    // Resend reports API failures (unverified sender, bad key, quota) in
    // `error` rather than throwing, so check it explicitly.
    const res = await resend.emails.send({ from: FROM, to, subject, html, headers });
    if (res?.error) {
      console.error('[email:error]', res.error.name, res.error.message);
      return { ok: false, error: res.error.message };
    }
    return { ok: true, id: res?.data?.id };
  } catch (err) {
    console.error('[email:error]', err);
    return { ok: false, error: String(err) };
  }
}

export function unsubscribeHeader(unsubUrl) {
  return {
    'List-Unsubscribe': `<${unsubUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
