-- Email marketing (2026-09-30): admin-written campaigns sent with Revlo's
-- marketing template. Every email carries a signed unsubscribe link; people who
-- unsubscribe, bounce or complain are never sent marketing again.
create table if not exists public.revlo_marketing_unsubscribes (
  email text primary key check (email = lower(email)),
  campaign_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.revlo_campaigns (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 1 and 150),
  preheader text check (preheader is null or char_length(preheader) <= 200),
  mode text not null check (mode in ('text', 'html')),
  body text not null check (char_length(body) <= 200000),
  audience text not null check (audience in ('publishers', 'followers', 'everyone')),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'cancelled')),
  created_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0
);

create table if not exists public.revlo_campaign_recipients (
  campaign_id uuid not null references public.revlo_campaigns(id) on delete cascade,
  email text not null check (email = lower(email)),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  error text,
  sent_at timestamptz,
  primary key (campaign_id, email)
);
create index if not exists revlo_campaign_recipients_pending_idx on public.revlo_campaign_recipients (campaign_id) where status = 'pending';

alter table public.revlo_marketing_unsubscribes enable row level security;
alter table public.revlo_campaigns enable row level security;
alter table public.revlo_campaign_recipients enable row level security;
revoke all on public.revlo_marketing_unsubscribes, public.revlo_campaigns, public.revlo_campaign_recipients from public, anon, authenticated;
