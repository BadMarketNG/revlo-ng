-- Alert me (2026-10-02): people ask to be emailed once a day when new posts match a category, area
-- and optional keyword. Double opt-in: an alert is active only after its confirmation link is opened.
-- Every email carries a one-click unsubscribe link (the same token).
create table if not exists public.revlo_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  category text not null default 'all',
  area text not null default 'all',
  keyword text,
  token text not null unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_sent_at timestamptz
);
create index if not exists revlo_alerts_email_idx on public.revlo_alerts (lower(email));
create index if not exists revlo_alerts_active_idx on public.revlo_alerts (confirmed_at) where unsubscribed_at is null;
alter table public.revlo_alerts enable row level security;
-- No policies: only the server (service role) reads or writes this table.
