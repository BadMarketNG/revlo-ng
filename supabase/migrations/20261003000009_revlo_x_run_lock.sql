-- One X refresh at a time. An expired lease can be taken over if a function
-- terminates before releasing it. Only the service role can access this row.
create table if not exists public.revlo_x_run_lock (
  id boolean primary key default true check (id),
  owner uuid,
  expires_at timestamptz not null default '-infinity'
);
insert into public.revlo_x_run_lock (id) values (true) on conflict (id) do nothing;
alter table public.revlo_x_run_lock enable row level security;
revoke all on public.revlo_x_run_lock from public, anon, authenticated;
