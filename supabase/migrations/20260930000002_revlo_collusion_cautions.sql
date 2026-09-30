-- Collusion cautions (2026-09-30). One row per caution email: a poster is
-- cautioned each time the number of followers the system judges fabricated
-- reaches another multiple of 10 (10, 20, 30, ...). The rows are the caution
-- history shown in the admin collusion report. An administrator clearing
-- cautions (cleared_at) removes the post warning; a later multiple of 10
-- still sends a new caution.
create table if not exists public.revlo_collusion_cautions (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  level integer not null check (level > 0 and level % 10 = 0),
  fabricated_followers integer not null,
  score numeric(5, 1) not null,
  email_sent boolean not null default false,
  cautioned_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by text,
  unique (email, level)
);

create index if not exists revlo_collusion_cautions_email_idx on public.revlo_collusion_cautions (email, cautioned_at desc);

alter table public.revlo_collusion_cautions enable row level security;
revoke all on public.revlo_collusion_cautions from public, anon, authenticated;
