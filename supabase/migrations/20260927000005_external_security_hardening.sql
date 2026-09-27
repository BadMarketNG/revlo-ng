create table if not exists revlo_rate_limit_events (
  id bigint generated always as identity primary key,
  action text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists revlo_rate_limit_events_lookup_idx
  on revlo_rate_limit_events (action, key_hash, created_at desc);
create index if not exists revlo_rate_limit_events_created_idx
  on revlo_rate_limit_events (created_at);

alter table revlo_rate_limit_events enable row level security;

create or replace function consume_revlo_rate_limit(
  p_action text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if length(p_action) < 1 or length(p_action) > 80
     or length(p_key_hash) <> 64
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 1 or p_window_seconds > 604800 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_action || ':' || p_key_hash, 0));
  select count(*) into recent_count
  from revlo_rate_limit_events
  where action = p_action
    and key_hash = p_key_hash
    and created_at > now() - make_interval(secs => p_window_seconds);

  if recent_count >= p_limit then return false; end if;
  insert into revlo_rate_limit_events(action, key_hash) values (p_action, p_key_hash);
  return true;
end;
$$;

revoke all on function consume_revlo_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function consume_revlo_rate_limit(text, text, integer, integer) to service_role;

comment on table revlo_rate_limit_events is
  'Hashed, short-lived counters for anonymous public actions. No raw email or IP address is stored.';

create table if not exists revlo_pending_public_actions (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('follow', 'contact')),
  token_hash text not null unique check (length(token_hash) = 64),
  post_uid text not null,
  email text not null,
  message text,
  source_ip inet,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists revlo_pending_public_actions_expiry_idx
  on revlo_pending_public_actions (expires_at)
  where consumed_at is null;

alter table revlo_pending_public_actions enable row level security;

comment on table revlo_pending_public_actions is
  'One-time email-verification challenges for public follow and contact actions.';
