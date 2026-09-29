# Revlo administrator access and operations

Last updated: 28 September 2026

## Service relationship

Revlo, BadMarket and RRSource are separate services. Revlo collaborates with BadMarket by using the BadMarket administrator panel as its secure access gateway. This arrangement does not describe or imply common ownership of the public services.

## How administrator access works

Revlo has no standalone administrator username or password form. An administrator must:

1. Have an active `@rrsource` administrator account in the BadMarket administrator panel.
2. Have multi-factor authentication completed for the current administrator session.
3. Have the **Revlo** section permission granted by a Main Admin. Main Admins have access automatically.
4. Open the Revlo section in the BadMarket administrator sidebar and choose a subsection.

BadMarket then issues a signed, one-use handoff that expires after 60 seconds. Revlo verifies the signature and records the one-use nonce before creating a one-hour Revlo administrator session. Reusing a handoff or opening the Revlo administrator URL directly without a valid session is rejected and returns the person to the Revlo public site. The relationship is intentionally one-way: BadMarket can open Revlo administration, while Revlo does not display or create links back to BadMarket administration.

### Grant or revoke access

Main Admin procedure:

1. Sign in to `https://badmarket.ng/admin` and complete MFA.
2. Open **Admin+ → Admin Accounts**.
3. Create or select the administrator.
4. Enable or disable the **Revlo** section permission.
5. Save the account.

Blocking the administrator account, resetting its MFA, or removing the Revlo permission prevents new Revlo handoffs. Revlo sessions expire after one hour. Logging out or timing out of BadMarket also revokes the matching Revlo session server-to-server; an open Revlo tab rechecks on focus and every 15 seconds. **Logout** inside Revlo clears that browser's Revlo cookie immediately.

## Revlo navigation

The Revlo section appears below BadMarket and contains:

- **Revlo Overview** — activity and publishing totals.
- **Reports** — email-verified visitor reports, optional private evidence and moderation actions.
- **All Posts** — search, edit, restore, remove and permanently delete Revlo posts.
- **Emails & Followers** — private poster email and follow-subscription administration.
- **BadMarket Links** — Revlo posts that users have linked to the collaborating BadMarket service.
- **Badges & Promos** — configure trust thresholds, Premium Green pricing, promotion pricing/availability, and create administrator promotions.
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
| One post receives reports from three independently verified email addresses | Hide the post and block its poster email/publishing IP | 7 days |
| Administrator permanently deletes a post | Block its poster email/publishing IP | 30 days |

One verified email address can count only once toward a post’s report threshold. Shared mobile or household networks do not prevent different verified people from reporting. An existing manual block is never shortened or replaced by an automatic temporary block. Automatic entries display their trigger and expiry in the administrator list.

## Verified reports and evidence

A visitor can see the available report reasons immediately, but cannot select one until their email address has been verified through a one-time link. When that link is opened in the same browser, Revlo returns the verified action to the original tab where possible; if the original tab is unavailable, the link continues safely in its own tab. A report may contain up to two optional JPEG, PNG or WebP evidence images, each no larger than 500 KB.

Evidence is stored in the private `report-evidence` bucket. It has no public storage policy. The protected **Reports** administration section creates five-minute signed viewing links only after administrator access has been checked. Deleting an individual report or all reports for a post also deletes their stored evidence. Reporter email addresses and evidence paths are moderation data and are never included in public post responses.

Blocked email or IP identities receive the same outward response as other visitors, but Revlo silently discards their reporting action and does not store evidence. This prevents the block list from becoming an account-discovery signal.

IP addresses used for enforcement are moderation data. They are excluded from all public post responses and are available only through service-role moderation code and the protected Revlo administration UI.

## Publisher badges, video and promotions

Revlo counts successful publications against the verified, normalised publisher email in a durable server-only table. Expiring or deleting a post does not erase that publishing history. By default Silver is awarded at 100 posts, Bronze at 500 and Gold at 1,500. Administrators can adjust all three thresholds. The badge saved on a post is determined by the server; browser input is ignored. Video upload is available only to a publisher who has earned a trust badge, with Silver as the first qualifying level.

Each normalised email address can have only one unexpired, unused publishing link. Repeated or simultaneous requests do not issue another email while the first link remains active. The user must open that link and complete its single post, or wait for its 30-minute expiry, before requesting another. Failed email deliveries release the reservation so the user can retry. The reservation is enforced atomically in the database, not only in the browser.

Premium Green is separate from trust badges. Its default eligibility is 10 posts and its default price is ₦5,000 for 30 days; administrators control all three values. Paid promotions default to ₦1,000 per day for 1–30 days. Payment is initialised and verified by the server, including exact amount, customer email and successful status, before a badge or promotion is fulfilled. Paystack webhook signatures are checked and fulfilment is idempotent. `PAYSTACK_SECRET_KEY` is server-only.

Active promotions appear at the top and between ordinary listings. One promotion remains visible; multiple promotions rotate every 20 seconds. Administrators can pause new user promotion purchases without removing already-paid active campaigns and can create house/external promotions without payment.

Administrator promotions accept a directly uploaded header image (JPEG, PNG, GIF or WebP, maximum 5 MB) or an HTTPS image URL. Direct uploads pass through an administrator-authenticated, same-origin, rate-limited endpoint; the server verifies the file signature before storing it under the dedicated `admin-promotions/` media prefix. Uploaded files override the optional URL field.

The administrator chooses either **Listings** or **Header advert** placement. Listing adverts retain the top-of-list and every-six-post positions. Header adverts are administrator-only and use the open desktop space beside the public post button; multiple active header adverts rotate every 20 seconds, while a single advert remains fixed. The header slot is hidden on narrow screens where it would collide with navigation controls.

## Public appearance

The Revlo public site offers **Light** and **Dark** page themes. Light is the default. The selection is stored locally in the visitor’s browser and does not require an account. Visitors can also collapse the introductory controls to the compact logo row; that preference is remembered locally. The public logo is rendered with its white image background removed so it remains clean in either theme.

The Revlo administrator surface uses a light background with Revlo green accents for consistent readability.

Visitors can switch the public feed between a focused one-post-per-row view and a two-post-per-row desktop view. The preference is stored only in that browser. On phone-sized screens Revlo always falls back to one column so cards and controls remain readable.

To discourage repeated opening of the creation flow, Revlo allows five create-post openings within a rolling minute and pauses the creation entry points on the sixth. That browser pause lasts two hours. Post-card controls have a separate shared counter: after five presses across any controls on any posts within one minute, the sixth press pauses every post-card control for 45 minutes. These browser pauses are shared by Revlo tabs through short-lived site cookies and reset if the visitor clears those cookies. They are usability controls, not security boundaries; server-side email, IP and publishing limits continue to enforce abuse protection independently.

Five actual browser reloads within one minute redirect the visitor to a caution page for a randomly assigned 20–50 minute cooldown. The page displays a live countdown and returns to Revlo automatically when it reaches zero. Ordinary navigation, opening a post, changing a filter and returning from an email link do not count as reloads.

The publisher chooses whether following is enabled on every new post. Switching **Let people follow you** off removes the follow action from that post and suppresses its email alert to existing followers. Existing subscriptions remain available for a later post only if the publisher switches following back on.

## Operational recovery

- If a Revlo subsection returns to the Revlo public site, confirm the administrator is active, MFA has been completed, and Revlo permission is enabled, then open the subsection again from the authorised control panel.
- If a handoff reports that it has already been used, open the subsection again from BadMarket to create a new one-use handoff.
- If Revlo badges are unavailable, verify `REVLO_ORIGIN` and the shared `REVLO_ADMIN_SSO_SECRET` on both deployments.
- If the administrator session is no longer required, use Revlo **Logout**. This clears only the Revlo session and returns to the Revlo public site.
- To remove a false-positive block, open the appropriate Revlo block list, review its reason/source, and choose **Remove block**.

## Required deployment configuration

RRSource and BadMarket administrator projects:

- `REVLO_ORIGIN=https://revlo.ng`
- `REVLO_ADMIN_SSO_SECRET` (at least 32 random characters)

The value must be identical on both administrator deployments and Revlo. Rotate all three together; partially rotating the set deliberately invalidates handoff verification.

Revlo project:

- `BADMARKET_ADMIN_ORIGIN=https://badmarket.ng`
- the same `REVLO_ADMIN_SSO_SECRET`
- Supabase service-role configuration used by the Revlo server
- `PAYSTACK_SECRET_KEY` for server-side Premium Green and promotion payments

Never expose the shared SSO secret to browser code or a `NEXT_PUBLIC_` environment variable.
