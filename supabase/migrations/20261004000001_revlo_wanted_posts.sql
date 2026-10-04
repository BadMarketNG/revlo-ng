-- Requests share the existing posts, expiry and contact flows. Existing posts stay offers.
alter table public.posts
  add column if not exists post_type text not null default 'offer',
  add column if not exists budget_max numeric(12, 2),
  add column if not exists needed_by timestamptz;

alter table public.posts
  add constraint posts_post_type_check check (post_type in ('offer', 'wanted')),
  add constraint posts_budget_max_check check (budget_max is null or (budget_max > 0 and budget_max <= 9999999999.99));

create index if not exists posts_wanted_live_idx
  on public.posts (category, expires_at desc) where post_type = 'wanted' and deleted_at is null;

alter table public.revlo_outcomes drop constraint if exists revlo_outcomes_outcome_check;
alter table public.revlo_outcomes add constraint revlo_outcomes_outcome_check
  check (outcome in ('sold', 'let', 'filled', 'done', 'found'));

-- Existing alerts keep watching offers. Sellers may opt in to Wanted requests separately.
alter table public.revlo_alerts
  add column if not exists post_type text not null default 'offer';
alter table public.revlo_alerts
  add constraint revlo_alerts_post_type_check check (post_type in ('offer', 'wanted'));
