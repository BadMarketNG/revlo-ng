-- Revlo (2026-10-01): contacting followers, contact-detail moderation,
-- suspensions and search tags.

-- Followers may give their publisher alias when following; only followers
-- with an alias can be contacted by the poster.
alter table public.follows add column if not exists follower_alias text
  check (follower_alias is null or char_length(follower_alias) between 2 and 24);

-- Which followers a poster has contacted from each post (for per-post limits).
create table if not exists public.revlo_follower_contacts (
  post_uid text not null,
  poster_email text not null check (poster_email = lower(poster_email)),
  follower_email text not null check (follower_email = lower(follower_email)),
  created_at timestamptz not null default now(),
  primary key (post_uid, follower_email)
);

alter table public.revlo_pending_public_actions drop constraint if exists revlo_pending_public_actions_action_check;
alter table public.revlo_pending_public_actions add constraint revlo_pending_public_actions_action_check
  check (action = any (array['follow', 'contact', 'report', 'contact_follower']));

-- Posts automatically flagged for contact details, awaiting admin review.
create table if not exists public.revlo_post_flags (
  id bigint generated always as identity primary key,
  post_uid text not null,
  poster_email text not null,
  reason text not null default 'contact_details',
  matches jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'removed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  unique (post_uid, reason)
);
create index if not exists revlo_post_flags_pending_idx on public.revlo_post_flags (created_at desc) where status = 'pending';

-- Publisher suspensions: no new posts, follows or follower contact until `until`.
create table if not exists public.revlo_suspensions (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  until timestamptz not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by text
);
create index if not exists revlo_suspensions_email_idx on public.revlo_suspensions (email, until desc);

-- Search tags on posts.
alter table public.posts add column if not exists tags text[] not null default '{}';

-- Admin-set limits.
alter table public.revlo_feature_settings
  add column if not exists normal_follower_contacts integer not null default 1 check (normal_follower_contacts >= 0),
  add column if not exists suspension_default_days integer not null default 10 check (suspension_default_days between 1 and 3650),
  add column if not exists tags_normal integer not null default 1 check (tags_normal between 0 and 20),
  add column if not exists tags_bronze integer not null default 2 check (tags_bronze between 0 and 20),
  add column if not exists tags_silver integer not null default 3 check (tags_silver between 0 and 20),
  add column if not exists tags_gold integer not null default 4 check (tags_gold between 0 and 20),
  add column if not exists tags_promoted integer not null default 5 check (tags_promoted between 0 and 20);

alter table public.revlo_follower_contacts enable row level security;
alter table public.revlo_post_flags enable row level security;
alter table public.revlo_suspensions enable row level security;
revoke all on public.revlo_follower_contacts, public.revlo_post_flags, public.revlo_suspensions from public, anon, authenticated;
