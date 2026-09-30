-- Email delivery failures (2026-09-30). Permanent bounces and spam complaints
-- reported by Amazon SES through SNS (/api/email/ses-events). Used as a
-- collusion signal: invented or throwaway follower addresses bounce.
create table if not exists public.revlo_email_events (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  event_type text not null check (event_type in ('bounce', 'complaint')),
  detail text,
  sns_message_id text,
  created_at timestamptz not null default now(),
  unique (sns_message_id, email)
);

create index if not exists revlo_email_events_email_idx on public.revlo_email_events (email);

alter table public.revlo_email_events enable row level security;
revoke all on public.revlo_email_events from public, anon, authenticated;
