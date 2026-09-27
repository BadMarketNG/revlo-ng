-- One emailed publish link = one post. A link is claimed by inserting its
-- hash here just before the post is created; the primary key makes a second
-- claim of the same link fail, including under concurrent requests.
create table if not exists revlo_used_publish_tokens (
  token_hash text primary key check (length(token_hash) = 64),
  post_uid text,
  used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists revlo_used_publish_tokens_expires_idx
  on revlo_used_publish_tokens (expires_at);

alter table revlo_used_publish_tokens enable row level security;

comment on table revlo_used_publish_tokens is
  'Hashes of emailed publish links that have already been used to create a post. No raw token or email is stored.';
