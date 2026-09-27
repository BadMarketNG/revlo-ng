create table if not exists revlo_admin_session_revocations (
  administrator_id text primary key,
  revoked_after timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table revlo_admin_session_revocations enable row level security;

comment on table revlo_admin_session_revocations is
  'Server-to-server BadMarket logout revocations for Revlo administrator sessions.';
