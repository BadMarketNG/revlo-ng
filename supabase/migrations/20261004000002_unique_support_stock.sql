-- Concurrent importers must not assign the same illustrative stock image to
-- two live Revlo support posts. The per-image advisory lock serializes checks.
create or replace function public.revlo_check_unique_support_stock()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.header_url is not distinct from old.header_url then
      return new;
    end if;
  end if;
  if new.poster_email = 'support@revlo.ng'
     and new.header_url like 'https://revlo.ng/samples/headers/%'
     and new.deleted_at is null and new.expires_at > now() then
    perform pg_advisory_xact_lock(hashtextextended(new.header_url, 0));
    if exists (
      select 1 from public.posts post
      where post.uid <> new.uid and post.poster_email = 'support@revlo.ng'
        and post.header_url = new.header_url and post.deleted_at is null
        and post.expires_at > now()
    ) then
      raise unique_violation using message = 'Support stock photo already in use by a live post';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists revlo_unique_support_stock on public.posts;
create trigger revlo_unique_support_stock
  before insert or update of header_url on public.posts
  for each row execute function public.revlo_check_unique_support_stock();
