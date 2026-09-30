-- Follow reasons and poster aliases (2026-09-30).
-- A follower may say why they follow; the note is shown publicly under the
-- poster's posts (never with the follower's email). Administrators can hide one.
alter table public.follows
  add column if not exists reason text check (reason is null or char_length(reason) between 2 and 200),
  add column if not exists reason_hidden boolean not null default false;

create index if not exists follows_reasons_idx on public.follows (poster_email, created_at desc)
  where reason is not null and reason_hidden = false;

-- A publisher's public alias, unique across Revlo regardless of case, kept
-- until they change or remove it on a later post. Posts carry a copy so the
-- feed can show it before the city.
alter table public.revlo_publisher_stats add column if not exists alias text
  check (alias is null or char_length(alias) between 2 and 24);
create unique index if not exists revlo_publisher_alias_unique on public.revlo_publisher_stats (lower(alias)) where alias is not null;

alter table public.posts add column if not exists poster_alias text;
