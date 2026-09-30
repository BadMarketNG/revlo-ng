-- Collusion detection signals (2026-09-30). One row per follow request,
-- follow confirmation, publish-link request and post: who acted, whose
-- content it concerned, and the network and device it came from. Device IDs
-- are random first-party cookie values, not fingerprints. Only the service
-- role (the server and the admin panel) can read them.
create table if not exists public.revlo_activity_signals (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('follow_request', 'follow_confirm', 'publish_link', 'post')),
  actor_email text not null check (actor_email = lower(actor_email)),
  subject_email text check (subject_email is null or subject_email = lower(subject_email)),
  post_uid text,
  ip inet,
  device_id text check (device_id is null or length(device_id) between 16 and 64),
  ua_hash text,
  created_at timestamptz not null default now()
);

create index if not exists revlo_activity_signals_subject_idx on public.revlo_activity_signals (subject_email, created_at);
create index if not exists revlo_activity_signals_actor_idx on public.revlo_activity_signals (actor_email, created_at);
create index if not exists revlo_activity_signals_device_idx on public.revlo_activity_signals (device_id) where device_id is not null;
create index if not exists revlo_activity_signals_ip_idx on public.revlo_activity_signals (ip) where ip is not null;

alter table public.revlo_activity_signals enable row level security;
revoke all on public.revlo_activity_signals from public, anon, authenticated;
