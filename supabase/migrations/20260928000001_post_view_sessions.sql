create table if not exists public.revlo_post_view_sessions (
  post_uid text not null,
  session_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_uid, session_id)
);

create index if not exists revlo_post_view_sessions_created_at_idx
  on public.revlo_post_view_sessions (created_at);

alter table public.revlo_post_view_sessions enable row level security;

revoke all on table public.revlo_post_view_sessions from public, anon, authenticated;
grant select, insert, delete on table public.revlo_post_view_sessions to service_role;

create or replace function public.record_revlo_post_session_view(
  p_uid text,
  p_session_id uuid
)
returns table (counted boolean, view_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counted boolean := false;
  v_view_count bigint;
begin
  if p_uid is null or length(p_uid) > 40 or p_session_id is null then
    return;
  end if;

  if not exists (
    select 1
      from public.posts
     where uid = p_uid
       and deleted_at is null
       and expires_at > now()
  ) then
    return query select false, null::bigint;
    return;
  end if;

  insert into public.revlo_post_view_sessions (post_uid, session_id)
  values (p_uid, p_session_id)
  on conflict do nothing;

  v_counted := found;

  if v_counted then
    update public.posts
       set views = coalesce(views, 0) + 1
     where uid = p_uid
       and deleted_at is null
       and expires_at > now()
    returning views::bigint into v_view_count;
  else
    select views::bigint
      into v_view_count
      from public.posts
     where uid = p_uid
       and deleted_at is null
       and expires_at > now();
  end if;

  return query select v_counted, v_view_count;
end;
$$;

revoke all on function public.record_revlo_post_session_view(text, uuid)
  from public, anon, authenticated;
grant execute on function public.record_revlo_post_session_view(text, uuid)
  to service_role;

comment on table public.revlo_post_view_sessions is
  'One durable Revlo feed view per post and per one-hour browser-tab session.';
