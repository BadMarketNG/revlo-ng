-- Keep hero/header advertising separate from promotions injected into listings.
alter table public.revlo_promotions
  add column if not exists placement text not null default 'feed';

alter table public.revlo_promotions
  drop constraint if exists revlo_promotions_placement_check;

alter table public.revlo_promotions
  add constraint revlo_promotions_placement_check
  check (placement in ('feed', 'header'));

create index if not exists revlo_promotions_placement_active_idx
  on public.revlo_promotions (placement, active, starts_at, ends_at);
