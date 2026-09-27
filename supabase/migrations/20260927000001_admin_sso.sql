-- One-time Revlo administrator handoffs from the separate BadMarket admin
-- service. The shared user identity is accepted only after BadMarket has
-- enforced its assigned Revlo permission and MFA.
create table if not exists admin_sso_nonces (
  nonce_hash text primary key,
  administrator_id uuid not null,
  administrator_email text not null,
  consumed_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists admin_sso_nonces_expires_at_idx on admin_sso_nonces(expires_at);
alter table admin_sso_nonces enable row level security;

comment on table admin_sso_nonces is
  'Service-role-only replay protection for one-time BadMarket-to-Revlo administrator handoffs.';
