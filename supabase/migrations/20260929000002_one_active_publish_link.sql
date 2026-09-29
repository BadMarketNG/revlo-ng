-- Exactly one unexpired, unredeemed publishing link may be active for an
-- email address. The advisory transaction lock closes the race between two
-- simultaneous browser requests without storing or exposing raw tokens.
create or replace function public.reserve_revlo_magic_link(
  p_token_hash text,
  p_email text,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  clean_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if length(coalesce(p_token_hash, '')) <> 64
    or clean_email = ''
    or p_expires_at <= now()
    or p_expires_at > now() + interval '31 minutes'
  then raise exception 'invalid magic link reservation'; end if;

  perform pg_advisory_xact_lock(hashtextextended('revlo-publish:' || clean_email, 0));

  if exists (
    select 1
    from public.revlo_magic_link_events
    where lower(email) = clean_email
      and redeemed_at is null
      and expires_at > now()
      and delivery_status in ('pending', 'sent')
  ) then
    return false;
  end if;

  insert into public.revlo_magic_link_events(token_hash, email, expires_at)
  values (p_token_hash, clean_email, p_expires_at);
  return true;
end;
$$;

revoke all on function public.reserve_revlo_magic_link(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reserve_revlo_magic_link(text, text, timestamptz)
  to service_role;

comment on function public.reserve_revlo_magic_link(text, text, timestamptz) is
  'Atomically reserves one active Revlo publish link per normalised email address.';
