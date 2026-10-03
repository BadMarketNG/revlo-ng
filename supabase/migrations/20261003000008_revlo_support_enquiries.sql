-- Support enquiries (2026-10-03): verified Contact messages on posts published by support@revlo.ng
-- (imported jobs and X posts), so the admin can open the original listing and reply to the applicant
-- with the employer's own application link. Never shown on the site.
create table if not exists public.revlo_support_enquiries (
  id uuid primary key default gen_random_uuid(),
  post_uid text not null,
  post_title text,
  from_email text not null,
  message text not null,
  created_at timestamptz not null default now(),
  replied_at timestamptz,
  reply_link text
);
create index if not exists revlo_support_enquiries_created_idx on public.revlo_support_enquiries (created_at desc);
alter table public.revlo_support_enquiries enable row level security;
-- No policies: only the server (service role) reads or writes this table.
