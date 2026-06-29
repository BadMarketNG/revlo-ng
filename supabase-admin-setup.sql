-- Revlo.ng admin additions
-- Run this in the Supabase SQL Editor.

-- 1. Soft-delete: posts get a deleted_at timestamp instead of being removed.
alter table posts add column if not exists deleted_at timestamptz;
create index if not exists posts_deleted_at_idx on posts (deleted_at);

-- 2. Admin audit log: records every admin action.
create table if not exists admin_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,        -- 'soft_delete' | 'restore' | 'change_duration' | 'unsubscribe'
  target_uid text,             -- post uid, when relevant
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_log_created_at_idx on admin_log (created_at desc);

-- RLS stays on; all access is via the server (service_role), so no public policies needed.
alter table admin_log enable row level security;
