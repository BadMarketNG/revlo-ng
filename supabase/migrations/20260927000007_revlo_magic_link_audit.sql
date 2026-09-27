-- Administrative audit trail for Revlo publish links. Raw magic-link tokens
-- are never stored; the hash lets the server update the same event as the
-- recipient opens it and creates a post.
create table if not exists revlo_magic_link_events (
  id bigint generated always as identity primary key,
  token_hash text not null unique check (length(token_hash) = 64),
  email text not null,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed')),
  delivery_id text,
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz not null,
  post_uid text
);

create index if not exists revlo_magic_link_events_email_idx
  on revlo_magic_link_events (email, requested_at desc);

create index if not exists revlo_magic_link_events_requested_idx
  on revlo_magic_link_events (requested_at desc);

alter table revlo_magic_link_events enable row level security;

comment on table revlo_magic_link_events is
  'Server-only audit of Revlo publish-link delivery, opening, and post creation. Stores token hashes only.';
