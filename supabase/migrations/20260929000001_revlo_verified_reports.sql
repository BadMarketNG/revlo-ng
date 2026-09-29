-- Reports now require a verified email (single-use emailed link, as for
-- publishing) and may include up to two private image attachments that only
-- administrators can view.

alter table public.reports add column if not exists reporter_email text;
alter table public.reports add column if not exists details text;
alter table public.reports add column if not exists attachments text[] not null default '{}';
alter table public.reports add column if not exists report_token_hash text;

alter table public.reports drop constraint if exists reports_details_length;
alter table public.reports add constraint reports_details_length check (details is null or length(details) <= 1000);
alter table public.reports drop constraint if exists reports_attachments_limit;
alter table public.reports add constraint reports_attachments_limit check (cardinality(attachments) <= 2);

-- Each emailed report link can be used once.
create unique index if not exists reports_report_token_hash_key
  on public.reports(report_token_hash) where report_token_hash is not null;

-- One report per verified email per post.
create unique index if not exists reports_post_reporter_email_key
  on public.reports(post_id, lower(reporter_email)) where reporter_email is not null;

-- Earlier anonymous reports were unique per post and network address. Keep
-- that rule for those legacy rows only, so several verified people sharing a
-- network (common on mobile carriers) can each report a post.
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.reports'::regclass and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(c.conkey) k join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)
          = array['post_id', 'reporter_ip']
  loop
    execute format('alter table public.reports drop constraint %I', r.conname);
  end loop;
  for r in
    select i.indexrelid::regclass::text as index_name
    from pg_index i
    where i.indrelid = 'public.reports'::regclass and i.indisunique and not i.indisprimary
      and i.indpred is null
      and (select array_agg(a.attname::text order by a.attname::text)
           from unnest(i.indkey) k join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k)
          = array['post_id', 'reporter_ip']
  loop
    execute format('drop index %s', r.index_name);
  end loop;
end $$;

create unique index if not exists reports_post_legacy_ip_key
  on public.reports(post_id, reporter_ip) where reporter_email is null and reporter_ip is not null;

-- Private bucket for report attachments. No storage policies are created, so
-- only the service role can read or write; administrators view files through
-- short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-evidence', 'report-evidence', false, 512000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.revlo_pending_public_actions
  drop constraint if exists revlo_pending_public_actions_action_check;
alter table public.revlo_pending_public_actions
  add constraint revlo_pending_public_actions_action_check
  check (action in ('follow', 'contact', 'report'));

create or replace function public.submit_verified_revlo_report(
  p_token_hash text,
  p_reason text,
  p_details text,
  p_attachments text[],
  p_reporter_ip inet
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  pending public.revlo_pending_public_actions%rowtype;
  target_post public.posts%rowtype;
  report_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if length(coalesce(p_token_hash, '')) <> 64
    or p_reason not in ('spam', 'false_info', 'offensive', 'copyright', 'other')
    or length(coalesce(p_details, '')) > 1000
    or cardinality(coalesce(p_attachments, '{}'::text[])) > 2
  then raise exception 'invalid report'; end if;

  select * into pending
  from public.revlo_pending_public_actions
  where action = 'report' and token_hash = p_token_hash
    and consumed_at is null and expires_at > now()
  for update;
  if not found then raise exception 'report verification expired'; end if;

  select * into target_post from public.posts
  where uid = pending.post_uid and deleted_at is null and expires_at > now()
  for update;
  if not found then raise exception 'post not available'; end if;

  if exists (
    select 1 from public.reports
    where post_id = target_post.id and lower(reporter_email) = lower(pending.email)
  ) then
    update public.revlo_pending_public_actions set consumed_at = now() where id = pending.id;
    return jsonb_build_object('ok', true, 'duplicate', true, 'post_id', target_post.id);
  end if;

  insert into public.reports(
    post_id, reason, reporter_ip, reporter_email, details, attachments, report_token_hash
  ) values (
    target_post.id, p_reason, p_reporter_ip, lower(pending.email),
    nullif(trim(coalesce(p_details, '')), ''), coalesce(p_attachments, '{}'::text[]), p_token_hash
  ) returning id into report_id;

  update public.revlo_pending_public_actions set consumed_at = now() where id = pending.id;
  return jsonb_build_object('ok', true, 'duplicate', false, 'report_id', report_id, 'post_id', target_post.id);
end;
$$;

revoke all on function public.submit_verified_revlo_report(text, text, text, text[], inet)
  from public, anon, authenticated;
grant execute on function public.submit_verified_revlo_report(text, text, text, text[], inet)
  to service_role;

comment on function public.submit_verified_revlo_report(text, text, text, text[], inet) is
  'Atomically consumes a verified reporter email challenge and records one private moderation report.';
