-- Source-only categories. Admin category events preserve existing ordering and edits.
insert into public.admin_log (action, target_uid, detail)
select 'category_create', 'category:' || c.slug,
  jsonb_build_object('slug', c.slug, 'label', c.label, 'position', c.position, 'administrator_email', 'migration')
from (values ('lodging', 'Lodging', 110), ('dating', 'Dating', 120)) as c(slug, label, position)
where not exists (
  select 1 from public.admin_log l where l.action = 'category_create' and l.detail->>'slug' = c.slug
);

create table if not exists public.revlo_discovery_imports (
  source text not null,
  external_id text not null,
  source_url text not null,
  post_uid text,
  imported_at timestamptz not null default now(),
  primary key (source, external_id)
);
create index if not exists revlo_discovery_imports_post_uid_idx on public.revlo_discovery_imports (post_uid) where post_uid is not null;
alter table public.revlo_discovery_imports enable row level security;
revoke all on public.revlo_discovery_imports from public, anon, authenticated;
