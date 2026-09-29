import { publicOrigin } from '@/lib/publicOrigin'

const APP_URL = publicOrigin()
const INK = '#1f2a22'
const MUTED = '#5f6b63'
const LINE = '#e3e8e4'
const BODY_MARK = '<!--revlo:body-->'

// One template per kind of email. The kind is recognised from the subject,
// which each route sets to fixed wording, so routes only supply the body.
const TEMPLATES = [
  {
    kind: 'publish-link',
    match: /^Your Revlo\.ng publish link/i,
    accent: '#1B5E20', tint: '#eef6ef', icon: '🔑',
    eyebrow: 'Publish link',
    heading: 'Your publish link is ready',
    note: 'This link works once and creates a single post. Please don\'t forward it: anyone with the link can publish as you.',
  },
  {
    kind: 'contact-confirm',
    match: /^Confirm your Revlo\.ng message/i,
    accent: '#1565C0', tint: '#edf3fb', icon: '✉️',
    eyebrow: 'Message confirmation',
    heading: 'Please confirm your message',
    note: 'Your message is only delivered after you confirm. The poster will see your email address so they can reply to you.',
  },
  {
    kind: 'message-received',
    match: /^Revlo\.ng: message about/i,
    accent: '#00695C', tint: '#ebf6f4', icon: '💬',
    eyebrow: 'New message',
    heading: 'You have a new message',
    note: 'Stay safe: meet in public places, inspect before you pay, and never send money for "processing" or "inspection" fees.',
  },
  {
    kind: 'follow-confirm',
    match: /^Confirm your Revlo\.ng follow/i,
    accent: '#6A1B9A', tint: '#f5eef9', icon: '🔔',
    eyebrow: 'Follow confirmation',
    heading: 'Confirm you\'d like updates',
    note: 'We\'ll only email you when this poster publishes something new, and every update has a one-click unsubscribe link.',
  },
  {
    kind: 'new-post',
    match: /^New post on Revlo\.ng/i,
    accent: '#1B5E20', tint: '#eef6ef', icon: '📣',
    eyebrow: 'From someone you follow',
    heading: 'Something new was just posted',
    note: null,
  },
  {
    kind: 'delete-confirm',
    match: /^Confirm deletion of your Revlo\.ng post/i,
    accent: '#C62828', tint: '#fcefef', icon: '🗑️',
    eyebrow: 'Delete request',
    heading: 'Confirm you want to delete your post',
    note: 'Deleting is permanent and cannot be undone. If you didn\'t ask for this, your post is safe: just ignore this email.',
  },
  {
    kind: 'report-confirm',
    match: /^Verify your email to report a Revlo\.ng post/i,
    accent: '#D32F2F', tint: '#fff1f1', icon: '⚠️',
    eyebrow: 'Report verification',
    heading: 'Confirm your email to continue',
    note: 'Your email address and any evidence are visible only to authorised Revlo moderators.',
  },
  // NOTE (2026-09-29): administrator badge changes and messages from the admin panel.
  {
    kind: 'badge-awarded',
    match: /^You've been awarded the .* badge on Revlo\.ng/i,
    accent: '#B8860B', tint: '#fbf6e6', icon: '🏅',
    eyebrow: 'Badge awarded',
    heading: 'You have a new Revlo badge',
    note: 'Your badge appears on your posts so people know you are an established publisher.',
  },
  {
    kind: 'badge-removed',
    match: /^Your Revlo\.ng badge has been removed/i,
    accent: '#6b7280', tint: '#f3f4f6', icon: '🏷️',
    eyebrow: 'Badge update',
    heading: 'Your badge has been removed',
    note: 'If you think this is a mistake, reply to this email or contact support@revlo.ng.',
  },
  {
    kind: 'badge-restored',
    match: /^Your Revlo\.ng badge has been updated/i,
    accent: '#1B5E20', tint: '#eef6ef', icon: '🔄',
    eyebrow: 'Badge update',
    heading: 'Your badge has been updated',
    note: null,
  },
  {
    kind: 'admin-message',
    match: /^Revlo\.ng · /,
    accent: '#1B5E20', tint: '#eef6ef', icon: '✉️',
    eyebrow: 'Message from Revlo',
    heading: null,
    note: 'This message was sent by the Revlo.ng team. Reply to support@revlo.ng if you have questions.',
  },
]

const GENERIC = {
  kind: 'general', accent: '#1B5E20', tint: '#eef6ef', icon: '🌿',
  eyebrow: 'Revlo.ng', heading: null, note: null,
}

export function templateFor(subject) {
  return TEMPLATES.find((t) => t.match.test(String(subject || ''))) || GENERIC
}

function stripTags(html) {
  return String(html).replace(/<\/?(span|strong|b|em|i|a)(\s[^>]*)?>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function buttonStyle(accent) {
  return `display:inline-block;background:${accent};color:#ffffff !important;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;line-height:1.2;`
}

// A link alone in its paragraph is the email's call to action, so present it
// as a button in the template's colour. Existing inline-styled buttons are
// recoloured to match too.
function buttonise(html, accent) {
  return String(html)
    .replace(
      /<p([^>]*)>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/p>/gi,
      (_m, _pAttrs, href, label) => `<p style="margin:24px 0;"><a href="${href}" style="${buttonStyle(accent)}">${label}</a></p>`,
    )
    .replace(/background:#1B5E20;color:#ffffff;/gi, `background:${accent};color:#ffffff;`)
}

// Routes call wrapEmail(content) to mark a body for the Revlo layout. The full
// template is applied in sendEmail, where the subject selects the design.
export function wrapEmail(content) {
  return `${BODY_MARK}${content}`
}

export function renderEmail({ subject, html }) {
  const body = String(html || '')
  if (/<html[\s>]/i.test(body) && !body.startsWith(BODY_MARK)) return body
  const content = body.startsWith(BODY_MARK) ? body.slice(BODY_MARK.length) : body
  const t = templateFor(subject)
  const preview = (t.heading ? `${t.heading}. ` : '') + stripTags(content)
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <title>${t.heading || 'Revlo.ng'}</title>
  <style>
    .rv-body p { margin: 0 0 16px; }
    .rv-body a { color: ${t.accent}; font-weight: 700; }
    .rv-body blockquote { margin: 0 0 18px; padding: 14px 18px; background: ${t.tint}; border-left: 4px solid ${t.accent}; border-radius: 6px; color: ${INK}; white-space: pre-wrap; }
    .rv-body strong { color: ${INK}; }
    @media (max-width: 620px) { .rv-pad { padding-left: 22px !important; padding-right: 22px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef2ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview.slice(0, 140)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ef;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <tr>
            <td style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:22px 24px 14px;">
                    <a href="${APP_URL}" style="text-decoration:none;">
                      <img src="${APP_URL}/email/revlo-logo.png" width="200" height="73" alt="revlo.ng — Revolution Nigeria" style="display:block;width:200px;max-width:60%;height:auto;border:0;outline:none;color:#1B5E20;font-size:22px;font-weight:900;">
                    </a>
                  </td>
                </tr>
                <tr><td style="background:${t.accent};height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td class="rv-pad" style="padding:30px 40px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td style="width:46px;height:46px;background:${t.tint};border-radius:12px;text-align:center;vertical-align:middle;font-size:22px;line-height:46px;">${t.icon}</td>
                      <td style="padding-left:14px;vertical-align:middle;">
                        <span style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${t.accent};">${t.eyebrow}</span>
                      </td>
                    </tr></table>
                    ${t.heading ? `<h1 style="margin:18px 0 0;font-size:24px;line-height:1.25;color:${INK};letter-spacing:-0.02em;">${t.heading}</h1>` : ''}
                  </td>
                </tr>
                <tr>
                  <td class="rv-pad rv-body" style="padding:22px 40px 6px;color:${INK};font-size:16px;line-height:1.65;">
                    ${buttonise(content, t.accent)}
                  </td>
                </tr>
                ${t.note ? `<tr>
                  <td class="rv-pad" style="padding:0 40px 8px;">
                    <div style="background:${t.tint};border-radius:10px;padding:13px 16px;color:${MUTED};font-size:13.5px;line-height:1.55;">${t.note}</div>
                  </td>
                </tr>` : ''}
                <tr>
                  <td class="rv-pad" style="padding:18px 40px 32px;color:${MUTED};font-size:15px;line-height:1.6;">
                    Warm regards,<br>
                    <strong style="color:${INK};">The Revlo team</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:22px 24px 8px;color:#7b857e;font-size:12px;line-height:1.7;">
              <a href="${APP_URL}/app.html" style="color:#1B5E20;text-decoration:none;font-weight:700;">revlo.ng</a>
              <span style="color:#c4ccc6;margin:0 7px;">&middot;</span>
              <a href="${APP_URL}/rules" style="color:#7b857e;text-decoration:none;">Rules</a>
              <span style="color:#c4ccc6;margin:0 7px;">&middot;</span>
              <a href="${APP_URL}/privacy" style="color:#7b857e;text-decoration:none;">Privacy</a>
              <span style="color:#c4ccc6;margin:0 7px;">&middot;</span>
              <a href="${APP_URL}/terms" style="color:#7b857e;text-decoration:none;">Terms</a>
              <p style="margin:10px 0 0;">
                You're receiving this because this email address was used on Revlo.ng.<br>
                Revlo will never ask for your password, PIN, OTP or BVN.
              </p>
              <p style="margin:10px 0 0;color:#9aa39c;">&copy; ${year} Revlo.ng. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Plain-text alternative for every email: improves deliverability and serves
// text-only mail clients. Links are kept as "label (url)".
export function htmlToText(html) {
  return String(html)
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = stripTags(label)
      return text && text !== href ? `${text}: ${href}` : href
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|blockquote|li)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&copy;/g, '©').replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#?\w+;/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
