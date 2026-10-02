-- Imported jobs (2026-10-02): job listings brought in from a partner job API and published as Revlo
-- posts under support@revlo.ng. Records where each post came from (kept private, never shown on the
-- site) so support can follow up enquiries, and so the same job is not imported twice.
create table if not exists public.revlo_imported_jobs (
  external_id text primary key,
  post_uid text,
  listing_url text not null,
  title text not null,
  company text,
  location text,
  imported_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists revlo_imported_jobs_post_uid_idx on public.revlo_imported_jobs (post_uid);
alter table public.revlo_imported_jobs enable row level security;
-- No policies: only the server (service role) reads or writes this table.
