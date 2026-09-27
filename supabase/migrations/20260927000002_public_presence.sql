-- Anonymous, short-lived Revlo visitor heartbeats for the shared operations
-- sidebar. No IP address, account, browser fingerprint or user-agent is kept.
create table if not exists public_visitor_presence (
  visitor_id text primary key check (char_length(visitor_id) between 12 and 80),
  path text not null default '/' check (char_length(path) <= 240),
  last_seen_at timestamptz not null default now()
);
create index if not exists public_visitor_presence_last_seen_idx on public_visitor_presence(last_seen_at desc);
alter table public_visitor_presence enable row level security;

comment on table public_visitor_presence is
  'Service-role-only anonymous Revlo heartbeat rows; stale rows are ignored after 75 seconds and periodically removed.';
