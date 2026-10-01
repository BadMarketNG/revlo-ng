-- Revlo email send log (2026-10-01): one row per email sent through
-- src/lib/email.js (recipient, subject, outcome; never bodies). Admins can
-- search, export and delete rows in the admin panel's Email log tab.
create table if not exists public.revlo_email_log (
  id bigint generated always as identity primary key,
  to_email text not null,
  subject text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  message_id text,
  created_at timestamptz not null default now()
);
create index if not exists revlo_email_log_created_idx on public.revlo_email_log (created_at desc);
create index if not exists revlo_email_log_to_idx on public.revlo_email_log (lower(to_email));

alter table public.revlo_email_log enable row level security;
revoke all on public.revlo_email_log from public, anon, authenticated;
