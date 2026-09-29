-- Publishers without a badge start with 5 posts per emailed publish link, and
-- the link still expires after 30 minutes (2026-09-29). Administrator-set.
alter table public.revlo_feature_settings
  add column if not exists normal_link_posts integer not null default 5 check (normal_link_posts between 1 and 1000);
