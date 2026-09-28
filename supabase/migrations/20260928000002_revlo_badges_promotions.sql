-- Revlo publisher reputation, premium badges and promoted posts.
create table if not exists public.revlo_feature_settings (
  id boolean primary key default true check (id),
  silver_posts integer not null default 100 check (silver_posts > 0),
  bronze_posts integer not null default 500 check (bronze_posts > 0),
  gold_posts integer not null default 1500 check (gold_posts > 0),
  premium_min_posts integer not null default 10 check (premium_min_posts > 0),
  premium_price_kobo integer not null default 500000 check (premium_price_kobo > 0),
  premium_days integer not null default 30 check (premium_days between 1 and 365),
  promotions_enabled boolean not null default true,
  promo_price_per_day_kobo integer not null default 100000 check (promo_price_per_day_kobo > 0),
  promo_min_days integer not null default 1 check (promo_min_days > 0),
  promo_max_days integer not null default 30 check (promo_max_days >= promo_min_days),
  updated_at timestamptz not null default now()
);
insert into public.revlo_feature_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.revlo_publisher_stats (
  email text primary key check (email = lower(email)),
  published_posts integer not null default 0 check (published_posts >= 0),
  badge_override text check (badge_override is null or badge_override in ('silver','bronze','gold')),
  updated_at timestamptz not null default now()
);

insert into public.revlo_publisher_stats (email, published_posts)
select lower(email), count(*)::integer
from public.revlo_magic_link_events
where redeemed_at is not null
group by lower(email)
on conflict (email) do update set
  published_posts = greatest(public.revlo_publisher_stats.published_posts, excluded.published_posts),
  updated_at = now();

create or replace function public.increment_revlo_publisher_posts(p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare result integer;
begin
  insert into public.revlo_publisher_stats (email, published_posts)
  values (lower(trim(p_email)), 1)
  on conflict (email) do update set
    published_posts = public.revlo_publisher_stats.published_posts + 1,
    updated_at = now()
  returning published_posts into result;
  return result;
end;
$$;

create table if not exists public.revlo_premium_badges (
  email text primary key check (email = lower(email)),
  active_until timestamptz not null,
  payment_reference text unique,
  updated_at timestamptz not null default now()
);

create table if not exists public.revlo_payment_intents (
  reference text primary key,
  email text not null check (email = lower(email)),
  kind text not null check (kind in ('premium','promo')),
  amount_kobo integer not null check (amount_kobo > 0),
  promo_days integer,
  post_uid text,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.revlo_promotions (
  id uuid primary key default gen_random_uuid(),
  post_uid text references public.posts(uid) on delete cascade,
  title text,
  description text,
  image_url text,
  target_url text,
  category text,
  source text not null default 'user' check (source in ('user','admin')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  payment_reference text unique,
  created_at timestamptz not null default now(),
  check (post_uid is not null or (title is not null and target_url is not null))
);
create index if not exists revlo_promotions_active_window_idx
  on public.revlo_promotions (active, starts_at, ends_at);

alter table public.posts add column if not exists trust_badge text
  check (trust_badge is null or trust_badge in ('silver','bronze','gold'));
alter table public.posts add column if not exists premium_badge boolean not null default false;

alter table public.revlo_feature_settings enable row level security;
alter table public.revlo_publisher_stats enable row level security;
alter table public.revlo_premium_badges enable row level security;
alter table public.revlo_payment_intents enable row level security;
alter table public.revlo_promotions enable row level security;

revoke all on public.revlo_feature_settings from anon, authenticated;
revoke all on public.revlo_publisher_stats from anon, authenticated;
revoke all on public.revlo_premium_badges from anon, authenticated;
revoke all on public.revlo_payment_intents from anon, authenticated;
revoke all on public.revlo_promotions from anon, authenticated;
revoke execute on function public.increment_revlo_publisher_posts(text) from public, anon, authenticated;
grant execute on function public.increment_revlo_publisher_posts(text) to service_role;
