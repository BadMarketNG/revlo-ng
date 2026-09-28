# Revlo public security boundary

Revlo is accountless, but it still protects publisher email addresses, uploaded
media, temporary control links and recipients from anonymous abuse. Public
requests never receive the Supabase service-role key.

## Browser and content controls

- Public post JSON-LD is serialized with HTML-significant characters escaped,
  so stored text cannot close the JSON-LD script element.
- Public post pages use a restrictive Content Security Policy that does not
  allow inline JavaScript.
- Every route receives anti-framing, MIME-sniffing, transport, referrer,
  opener and permissions headers.
- The compiled public application temporarily permits inline script because
  it is a static bundle. It does not render stored HTML. Removing that allowance
  requires rebuilding that frontend with external scripts or CSP hashes.

## Anonymous-action controls

- Uploads are limited by source IP and accepted only when their file signature
  matches JPEG, PNG, GIF, WebP, MP4 or WebM. The client filename and declared
  `Content-Type` do not determine the stored type.
- Images are limited to 1.5 MB. Videos are limited to 25 MB and require a valid
  one-use publishing token for the same email plus server-calculated Silver,
  Bronze or Gold eligibility. Email and IP blocks are rechecked at upload and
  again when the post is created.
- Publishing, magic-link, delete-link, follow and contact requests have
  independent database-backed limits. Rate-limit keys are SHA-256 hashes; the
  counter table does not store raw email or IP values.
- Follow and contact requests take effect only after the submitted sender
  address opens a one-time, 30-minute confirmation link.
- Existing Revlo email and IP block lists remain an additional moderation
  layer; rate limiting does not depend on a block first being created.
- Email blocks support exact addresses and whole-domain rules such as
  `*@example.com`. Domain rules also cover subdomains.
- A bundled, locally evaluated snapshot blocks known disposable email domains
  without making a runtime request to a third-party reputation service. The
  snapshot source and count are recorded in
  `src/data/disposable-email-domains.metadata.json`; it is an abuse-prevention
  input, not a claim about any person using a listed provider.
- Blocked email-triggering requests return the same public success response as
  ordinary requests but create no pending action and send no message. Contact
  relays and follower notifications also suppress delivery to blocked owners
  and recipients. This prevents the block list becoming an address/domain
  enumeration oracle.

## Required secrets

`TOKEN_SECRET`, `CRON_SECRET` and `REVLO_ADMIN_SSO_SECRET` must each be at
least 32 characters in production. Token and cron operations fail closed if a
secret is absent or too short. There is no repository fallback secret.
`PAYSTACK_SECRET_KEY` is also server-only. Payment fulfilment verifies the
provider status, exact amount and customer email, and webhook requests require
Paystack's HMAC-SHA512 signature.

## Deployment

Apply all Supabase migrations before deploying application code. In particular,
`20260927000005_external_security_hardening.sql` installs the atomic public
rate-limit function and one-time email-confirmation store. If this migration is
missing, affected public actions intentionally return `503` instead of running
without abuse controls.

After deployment, verify:

1. `/p/<valid-id>` returns a CSP without `unsafe-inline` in `script-src`.
2. A title containing `</script>` is emitted as `\u003c/script\u003e` inside
   JSON-LD and never creates another script element.
3. Revlo cannot be framed, and responses carry `nosniff` and HSTS.
4. A renamed or spoofed upload is rejected with `415`.
5. Follow/contact do not change state before their email link is opened.
6. `/api/cron/expire` returns `401` for a wrong secret and `503` if the server
   secret is unavailable.
7. Exact and `*@domain` blocks suppress publish links, follow confirmations,
   delete links and contact confirmations without changing the success UI.
8. Contact confirmation never relays a message to a post owner who became
   blocked after the sender requested confirmation.
