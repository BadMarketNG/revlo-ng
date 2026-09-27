# Revlo administrator access and operations

Last updated: 27 September 2026

## Service relationship

Revlo, BadMarket and RRSource are separate services. Revlo collaborates with BadMarket by using the BadMarket administrator panel as its secure access gateway. This arrangement does not describe or imply common ownership of the public services.

## How administrator access works

Revlo has no standalone administrator username or password form. An administrator must:

1. Have an active `@rrsource` administrator account in the BadMarket administrator panel.
2. Have multi-factor authentication completed for the current administrator session.
3. Have the **Revlo** section permission granted by a Main Admin. Main Admins have access automatically.
4. Open the Revlo section in the BadMarket administrator sidebar and choose a subsection.

BadMarket then issues a signed, one-use handoff that expires after 60 seconds. Revlo verifies the signature and records the one-use nonce before creating a one-hour Revlo administrator session. Reusing a handoff or opening the Revlo administrator URL directly without a valid session is rejected and returns the person to the BadMarket administrator panel.

### Grant or revoke access

Main Admin procedure:

1. Sign in to `https://badmarket.ng/admin` and complete MFA.
2. Open **Admin+ → Admin Accounts**.
3. Create or select the administrator.
4. Enable or disable the **Revlo** section permission.
5. Save the account.

Blocking the administrator account, resetting its MFA, or removing the Revlo permission prevents new Revlo handoffs. Existing Revlo sessions expire after one hour; use **Logout** in Revlo when access must end immediately on that browser.

## Revlo navigation

The Revlo section appears below BadMarket and contains:

- **Revlo Overview** — activity and publishing totals.
- **Reports** — posts reported by visitors and moderation actions.
- **All Posts** — search, edit, restore, remove and permanently delete Revlo posts.
- **Emails & Followers** — private poster email and follow-subscription administration.
- **BadMarket Links** — Revlo posts that users have linked to the collaborating BadMarket service.
- **Email Block List** — Revlo-only manual and automatic email blocks.
- **IP Block List** — Revlo-only manual and automatic network-address blocks.

The BadMarket administrator sidebar shows active queue badges for Revlo subsections. The header also shows the number of visitors currently active on Revlo and an exact page breakdown. Revlo visitor presence uses a random browser identifier and short-lived heartbeat; it does not store an IP address, account, user-agent or browser fingerprint for the presence indicator.

## Email and IP block lists

Manual blocks are permanent until an authorised Revlo administrator removes them. Administrators should enter a clear reason because the record identifies who created it and when.

Blocks are enforced on Revlo publishing and public write actions, including post creation, media upload, report submission, contact messages, follows, BadMarket-link requests and publish-link requests. They do not block unsubscribe or owner-delete requests, so a blocked person can still stop email and remove their own content.

### Automatic triggers

Revlo adds both the available email and publishing IP to its block lists when these triggers occur:

| Trigger | Action | Duration |
| --- | --- | --- |
| Publishing limit exceeded | Reject the request and block the email/IP | 24 hours |
| One post receives reports from three independent IP addresses | Hide the post and block its poster email/publishing IP | 7 days |
| Administrator permanently deletes a post | Block its poster email/publishing IP | 30 days |

One IP address can count only once toward a post’s report threshold. An existing manual block is never shortened or replaced by an automatic temporary block. Automatic entries display their trigger and expiry in the administrator list.

IP addresses used for enforcement are moderation data. They are excluded from all public post responses and are available only through service-role moderation code and the protected Revlo administration UI.

## Public appearance

The Revlo public site offers **Light** and **Dark** page themes. Light is the default. The selection is stored locally in the visitor’s browser and does not require an account.

The Revlo administrator surface uses a light background with Revlo green accents for consistent readability.

## Operational recovery

- If a Revlo subsection redirects back to BadMarket, confirm the administrator is active, MFA has been completed, and Revlo permission is enabled.
- If a handoff reports that it has already been used, open the subsection again from BadMarket to create a new one-use handoff.
- If Revlo badges are unavailable, verify `REVLO_ORIGIN` and the shared `REVLO_ADMIN_SSO_SECRET` on both deployments.
- If the administrator session is no longer required, use Revlo **Logout**. This clears only the Revlo session and returns to the BadMarket administrator panel.
- To remove a false-positive block, open the appropriate Revlo block list, review its reason/source, and choose **Remove block**.

## Required deployment configuration

BadMarket administrator project:

- `REVLO_ORIGIN=https://revlo.ng`
- `REVLO_ADMIN_SSO_SECRET` (at least 32 random characters)

Revlo project:

- `BADMARKET_ADMIN_ORIGIN=https://badmarket.ng`
- the same `REVLO_ADMIN_SSO_SECRET`
- Supabase service-role configuration used by the Revlo server

Never expose the shared SSO secret to browser code or a `NEXT_PUBLIC_` environment variable.
