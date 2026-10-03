# Revlo Lodging and Dating sources

The new categories are source-only. Public publishers cannot submit posts to them; the daily `import-discovery` cron creates posts under `support@revlo.ng`. It stores only source IDs and URLs for deduplication. Contact and follow are disabled on imported posts.

## Dating

- [Zikoko Love Life RSS](https://www.zikoko.com/category/ships/love-life/feed/): recent Nigerian relationship stories.
- [Kisses & Huggs RSS](https://kissesandhuggs.org/feed/): recent Nigerian Christian guidance that specifically concerns singles, dating or courtship. Posts identify its faith perspective.

The importer keeps only a publisher's headline and a link to the original article. It excludes stale posts, outside domains, personal profiles, minors and direct contact requests. It does not copy article bodies or photographs.

## Lodging

- [Shortlet Partner API](https://shortlet.app/documentation): approved Nigerian short stays. Configure `SHORTLET_PARTNER_API_KEY` and the provider-confirmed live `SHORTLET_API_BASE_URL` (the adapter accepts `https://api.shortlet.app`). Staging listings are never published.
- [RayProp Stays API](https://rayprop.io/): verified, available Nigerian shortlets. Configure `RAYPROP_API_KEY`. A listing also needs an official public RayProp URL in the API response.

Both adapters remain inactive without live credentials. The job accepts only Nigerian locations, positive NGN nightly rates, source-hosted booking links and up to three safe HTTPS images. It publishes 24-hour posts so old price or availability claims disappear quickly. Readers are directed to the provider to confirm dates and pay there; Revlo never collects deposits or transfers guest data to these feeds.

Each provider is capped at six new posts per day and each editorial publisher at three. Imported IDs prevent duplicate posts within the relevant window. Errors from one source do not block the other sources.
