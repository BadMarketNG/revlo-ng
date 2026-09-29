-- Administrator-set publish link allowances per badge (2026-09-29). Defaults:
-- Silver 50, Bronze 100, Gold 200 posts per link, with no time limit.
-- claim_revlo_publish_link_use accepts up to 1,000 posts per link.
alter table public.revlo_feature_settings
  add column if not exists silver_link_posts integer not null default 50 check (silver_link_posts between 1 and 1000),
  add column if not exists bronze_link_posts integer not null default 100 check (bronze_link_posts between 1 and 1000),
  add column if not exists gold_link_posts integer not null default 200 check (gold_link_posts between 1 and 1000);
