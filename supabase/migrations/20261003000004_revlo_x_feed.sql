-- "From X" strip (2026-10-03). Posts from X's recent search, cached for visitors; only a scheduled job
-- calls X. Spending is metered per post read (revlo_x_usage) with daily and monthly caps in code.
create table if not exists public.revlo_x_usage (
  day date primary key,
  posts_read integer not null default 0,
  requests integer not null default 0
);
-- One row per category × city search block: the newest post seen (so the same post is never paid for twice).
create table if not exists public.revlo_x_blocks (
  block_key text primary key,
  since_id text,
  last_run timestamptz
);
create table if not exists public.revlo_x_posts (
  id text primary key,
  block_key text not null,
  category text not null,
  city text not null,
  text text not null,
  author_name text not null,
  author_username text not null,
  author_avatar text,
  media_url text,
  posted_at timestamptz not null,
  fetched_at timestamptz not null default now()
);
create index if not exists revlo_x_posts_lookup_idx on public.revlo_x_posts (category, posted_at desc);
alter table public.revlo_x_usage enable row level security;
alter table public.revlo_x_blocks enable row level security;
alter table public.revlo_x_posts enable row level security;
-- No policies: only the server (service role) reads or writes these tables.
