import crypto from 'crypto';
import { htmlToText, renderEmail } from '@/lib/emailTemplate';

// Amazon SES (API v2) with request signing done here (AWS Signature V4), so no
// AWS SDK dependency is needed. Credentials use SES_* names because Vercel
// reserves the standard AWS_* variables.
const REGION = process.env.SES_REGION || '';
const ACCESS_KEY_ID = process.env.SES_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.SES_SECRET_ACCESS_KEY || '';
const CONFIGURATION_SET = process.env.SES_CONFIGURATION_SET || '';
const FROM = process.env.EMAIL_FROM || 'Revlo.ng <noreply@revlo.ng>';

const configured = Boolean(REGION && ACCESS_KEY_ID && SECRET_ACCESS_KEY);

const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value, 'utf8').digest();

function signedRequest(path, payload) {
  const host = `email.${REGION}.amazonaws.com`;
  const body = JSON.stringify(payload);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${REGION}/ses/aws4_request`;
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, sha256(body)].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${SECRET_ACCESS_KEY}`, day), REGION), 'ses'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');
  return fetch(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
    cache: 'no-store',
  });
}

// Send an email. If SES isn't configured, we log and no-op so the app still
// works in development without email set up.
export async function sendEmail({ to, subject, html, headers }) {
  if (!configured) {
    console.log('[email:skipped] SES is not configured. Would send:', { to, subject });
    return { skipped: true };
  }
  const fullHtml = renderEmail({ subject, html });
  // SES takes Reply-To as a field, not a custom header.
  const { 'Reply-To': replyTo, ...customHeaders } = headers || {};
  const headerList = Object.entries(customHeaders).map(([Name, Value]) => ({ Name, Value: String(Value) }));
  const payload = {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [].concat(to) },
    ...(replyTo ? { ReplyToAddresses: [].concat(replyTo) } : {}),
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: fullHtml, Charset: 'UTF-8' },
          Text: { Data: htmlToText(fullHtml), Charset: 'UTF-8' },
        },
        ...(headerList.length ? { Headers: headerList } : {}),
      },
    },
    ...(CONFIGURATION_SET ? { ConfigurationSetName: CONFIGURATION_SET } : {}),
  };
  try {
    // SES reports failures (unverified sender, sandbox recipient, bad
    // credentials, throttling) as non-2xx JSON responses rather than throwing.
    const response = await signedRequest('/v2/email/outbound-emails', payload);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const name = response.headers.get('x-amzn-errortype')?.split(':')[0] || `HTTP ${response.status}`;
      console.error('[email:error]', name, result.message || result.Message || '');
      return { ok: false, error: result.message || result.Message || name };
    }
    return { ok: true, id: result.MessageId };
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
