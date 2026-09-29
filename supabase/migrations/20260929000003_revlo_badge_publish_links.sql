-- Badge publish links (2026-09-29). A Silver, Bronze or Gold publisher's
-- emailed link can create several posts (50, 100 or 200) and has no time
-- limit. Normal publishers keep the one-post, 30-minute link, which still uses
-- revlo_used_publish_tokens unchanged.
--
-- Each post made with a badge link is one row here. A link stays usable while
-- its revlo_magic_link_events row has not expired; requesting a new badge link
-- expires the previous one, so a lost or leaked link can be replaced.

create table if not exists public.revlo_publish_link_uses (
  id bigint generated always as identity primary key,
  token_hash text not null check (length(token_hash) = 64),
  post_uid text,
  used_at timestamptz not null default now()
);

create index if not exists revlo_publish_link_uses_token_idx
  on public.revlo_publish_link_uses (token_hash);

alter table public.revlo_publish_link_uses enable row level security;
revoke all on public.revlo_publish_link_uses from public, anon, authenticated;

-- Atomically claims one post from a badge link. Returns
-- { ok, use_id, remaining } or { ok: false, reason: 'inactive' | 'used_up' }.
create or replace function public.claim_revlo_publish_link_use(p_token_hash text, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  used_count integer;
  new_id bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if length(coalesce(p_token_hash, '')) <> 64 or p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid publish link claim';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('revlo-publish-link:' || p_token_hash, 0));

  if not exists (
    select 1 from public.revlo_magic_link_events
    where token_hash = p_token_hash and expires_at > now()
  ) then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  select count(*) into used_count from public.revlo_publish_link_uses where token_hash = p_token_hash;
  if used_count >= p_limit then
    return jsonb_build_object('ok', false, 'reason', 'used_up', 'remaining', 0);
  end if;

  insert into public.revlo_publish_link_uses (token_hash) values (p_token_hash) returning id into new_id;
  return jsonb_build_object('ok', true, 'use_id', new_id, 'remaining', p_limit - used_count - 1);
end;
$$;

revoke all on function public.claim_revlo_publish_link_use(text, integer) from public, anon, authenticated;
grant execute on function public.claim_revlo_publish_link_use(text, integer) to service_role;
