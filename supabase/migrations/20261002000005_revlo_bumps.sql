-- Bump up (2026-10-02): a poster pays to put their post back at the top for 24 hours.
-- The post returns to "Right now" (its created_at moves to the bump time; the original is kept here)
-- and is pinned above the shuffled feed with a visible "Bumped" label while the bump lasts.
alter table public.revlo_payment_intents drop constraint if exists revlo_payment_intents_kind_check;
alter table public.revlo_payment_intents add constraint revlo_payment_intents_kind_check check (kind in ('premium', 'promo', 'bump'));

create table if not exists public.revlo_bumps (
  id uuid primary key default gen_random_uuid(),
  post_uid text not null,
  reference text not null unique,
  original_created_at timestamptz,
  bumped_at timestamptz not null default now()
);
create index if not exists revlo_bumps_recent_idx on public.revlo_bumps (bumped_at desc);
alter table public.revlo_bumps enable row level security;
-- No policies: only the server (service role) reads or writes this table.
