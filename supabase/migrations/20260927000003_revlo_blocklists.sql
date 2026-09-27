-- Revlo-only moderation block lists. These records are deliberately separate
-- from BadMarket and RRSource access controls.
create table if not exists revlo_access_blocks (
  id uuid primary key default gen_random_uuid(),
  block_type text not null check (block_type in ('email', 'ip')),
  value text not null,
  reason text not null default 'Manual administrator block',
  source text not null default 'manual' check (source in ('manual', 'publishing_limit', 'report_threshold', 'hard_delete')),
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  unique (block_type, value)
);

create index if not exists revlo_access_blocks_active_idx
  on revlo_access_blocks (block_type, value, expires_at);

alter table revlo_access_blocks enable row level security;

-- Stored for moderation only and never included in Revlo's public post fields.
alter table posts add column if not exists source_ip inet;
alter table reports add column if not exists reporter_ip inet;

-- One report per post from a given network address. Historical rows without an
-- address remain valid but cannot independently trigger an automatic block.
create unique index if not exists reports_post_reporter_ip_unique_idx
  on reports (post_id, reporter_ip)
  where reporter_ip is not null;

comment on table revlo_access_blocks is
  'Revlo-only email and IP blocks maintained by Revlo administrators and documented automatic abuse triggers.';
comment on column posts.source_ip is
  'Publishing address visible only to service-role moderation code; excluded from every public select.';
