-- Report a scam contact (2026-10-03). Anyone who was contacted fraudulently (by a poster, or by someone
-- replying to their post, or off Revlo) can report the email address / phone number / handle. The reporter
-- confirms their email first; an administrator reviews; only confirmed reports count in the public check,
-- and confirming blocks the reported email from posting or contacting people on Revlo.
-- Reported emails and numbers are kept for administrators and matched publicly only by hash.
create table if not exists public.revlo_scam_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_email text not null check (reporter_email = lower(reporter_email)),
  reporter_ip text,
  contact_method text not null,
  scam_type text not null,
  subject_email text,
  subject_email_hash text,
  subject_phone text,
  subject_phone_hash text,
  subject_handle text,
  post_uid text,
  details text not null,
  money_lost numeric,
  currency text,
  attachments text[] not null default '{}',
  status text not null default 'unconfirmed' check (status in ('unconfirmed', 'pending', 'confirmed', 'dismissed')),
  token text not null unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  reviewed_at timestamptz,
  constraint revlo_scam_reports_subject check (subject_email is not null or subject_phone is not null or subject_handle is not null)
);
create index if not exists revlo_scam_reports_email_hash_idx on public.revlo_scam_reports (subject_email_hash) where status = 'confirmed';
create index if not exists revlo_scam_reports_phone_hash_idx on public.revlo_scam_reports (subject_phone_hash) where status = 'confirmed';
create index if not exists revlo_scam_reports_status_idx on public.revlo_scam_reports (status, created_at desc);
alter table public.revlo_scam_reports enable row level security;
-- No policies: only the server (service role) reads or writes this table.

-- Confirmed scam reports block the reported email (source 'scam_report').
alter table public.revlo_access_blocks drop constraint if exists revlo_access_blocks_source_check;
alter table public.revlo_access_blocks add constraint revlo_access_blocks_source_check
  check (source in ('manual', 'publishing_limit', 'report_threshold', 'hard_delete', 'scam_report'));
