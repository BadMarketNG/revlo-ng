const APP_URL = process.env.APP_URL || 'https://revlo.ng'

export function wrapEmail(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Revlo.ng</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1B5E20;height:6px;border-radius:8px 8px 0 0;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="background:#ffffff;padding:26px 36px 18px;">
              <span style="font-size:34px;font-weight:900;color:#1B5E20;letter-spacing:-1px;">revlo<span style="color:#D32F2F;">.</span><span style="color:#1a1a1a;">ng</span></span><br>
              <span style="font-size:11px;font-weight:700;color:#1B5E20;letter-spacing:0.28em;">REVOLUTION NIGERIA</span>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="background:#e3e3e3;height:1px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 36px 28px;color:#111827;font-size:15px;line-height:1.6;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 36px;border-radius:0 0 8px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;padding-bottom:10px;">
                    <a href="${APP_URL}" style="color:#1B5E20;text-decoration:none;font-size:12px;font-weight:700;">revlo.ng</a>
                    <span style="color:#d1d5db;margin:0 8px;">|</span>
                    <a href="${APP_URL}/api/contact" style="color:#6b7280;text-decoration:none;font-size:12px;">Contact</a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0;font-size:11px;color:#9ca3af;">
                      &copy; ${new Date().getFullYear()} Revlo.ng &mdash; Publicity without identity<br>
                      Posts expire automatically. No accounts required.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
