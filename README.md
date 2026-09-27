# Revlo.ng — Backend

Next.js + Supabase backend for Revlo.ng: an accountless, time-based publishing
platform. Posts expire automatically (24h / 30d / 60d / 90d). No accounts,
likes, comments, or DMs.

## What's in here

```
src/
  app/
    page.js                  redirects to the front end (public/app.html)
    layout.js
    api/
      posts/route.js         GET feed (by duration) + POST create
      posts/[uid]/route.js   GET one post (+ view count)
      contact/route.js       relay a message to the poster (email hidden)
      follow/route.js        follow a poster by email
      unfollow/route.js      one-click unsubscribe
      report/route.js        report a post
      delete/route.js        request delete link + confirm delete (token)
      bm-link/route.js       link to BadMarket.ng (one-time, DB-enforced)
      upload/route.js        upload image/video to Supabase Storage
      magic-link/route.js    email publish verification link
      cron/expire/route.js   delete expired posts (Vercel Cron)
  lib/
    supabaseAdmin.js         server Supabase client (service_role)
    util.js                  uid, expiry, signed tokens, validation
    email.js                 Resend email helper
public/
  app.html                   the compiled front end (served at /)
  revlo-api.js               client helper to call the API
```

## Setup (on your Mac)

You already have Node 20 and npm installed.

1. **Install dependencies** (in this folder):
   ```
   npm install
   ```

2. **Create your env file** from the template:
   ```
   cp .env.local.example .env.local
   ```
   Then open `.env.local` and fill in:
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Settings → API → service_role key
   - `TOKEN_SECRET` and `CRON_SECRET` — generate each with: `openssl rand -hex 32`
   - `RESEND_API_KEY` — optional; leave blank to skip emails in dev
   (`SUPABASE_URL` is already filled in with your project URL.)

3. **Create the storage bucket** — in the Supabase SQL Editor, run the contents
   of `supabase-storage-setup.sql`.

4. **Run it:**
   ```
   npm run dev
   ```
   Open http://localhost:3000

## Connecting the front end

The front end in `public/app.html` currently keeps data in browser memory. To
make it use the real backend, it needs to call the functions in
`public/revlo-api.js` (e.g. `RevloAPI.listPosts()`, `RevloAPI.createPost(...)`)
instead of its in-memory store. This wiring is the next step — see the API
client for the exact functions available.

## Deploy

Push to GitHub and import into Vercel. Add the same environment variables in
Vercel → Settings → Environment Variables. The `vercel.json` cron runs
`/api/cron/expire` hourly to remove expired posts.

## Security notes

- All DB access goes through the server with the **service_role** key, which
  bypasses RLS. The key is never sent to the browser.
- RLS is ON for all tables, so the public anon key can't read or write directly.
- The poster's email is never returned by any public endpoint.
- Delete and magic links use signed, expiring tokens (HMAC-SHA256).

## Administrator access

Revlo is a separate service collaborating with BadMarket. It does not expose a standalone administrator username/password form. Administrators enter through the Revlo section of the BadMarket administrator panel, where their Main Admin-assigned Revlo permission and MFA session are checked before a signed, one-time handoff is issued.

Deployment requires the same 32-byte-or-longer `REVLO_ADMIN_SSO_SECRET` in both projects, `BADMARKET_ADMIN_ORIGIN=https://badmarket.ng` in Revlo, and `REVLO_ORIGIN=https://revlo.ng` in BadMarket. Apply the Supabase migrations before enabling the handoff; the nonce table prevents a captured handoff from being reused.
