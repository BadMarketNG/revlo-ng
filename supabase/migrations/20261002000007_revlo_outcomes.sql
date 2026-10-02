-- Results (2026-10-02): posters mark a post as sold / let / filled. Revlo records the real time it took
-- (from the post's original publication) and, only with the poster's permission, shows the result
-- as a shareable card ("Let in 3 hours via Revlo"). No personal details are ever shown.
create table if not exists public.revlo_outcomes (
  id uuid primary key default gen_random_uuid(),
  post_uid text not null unique,
  outcome text not null check (outcome in ('sold', 'let', 'filled', 'done')),
  category text,
  label text not null,              -- e.g. "2-bedroom flat · Yaba" (from the post; no personal data)
  hours numeric not null,           -- time from original publication to the result
  share boolean not null default false,
  resolved_at timestamptz not null default now()
);
create index if not exists revlo_outcomes_recent_idx on public.revlo_outcomes (resolved_at desc) where share;

-- One "Did it go?" email per post.
create table if not exists public.revlo_outcome_prompts (
  post_uid text primary key,
  sent_at timestamptz not null default now()
);

alter table public.revlo_outcomes enable row level security;
alter table public.revlo_outcome_prompts enable row level security;
-- No policies: only the server (service role) reads or writes these tables.
