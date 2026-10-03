-- More categories (2026-10-03, owner's request): Gadgets, Wears, Electronics, Vehicles, Repairs.
-- Categories are built from category_* events in admin_log (src/lib/revloCategories.js), the same way the
-- admin Categories tab creates them. Each is added only if it has never been created before.
insert into public.admin_log (action, target_uid, detail)
select 'category_create', 'category:' || c.slug, jsonb_build_object('slug', c.slug, 'label', c.label, 'position', c.position, 'administrator_email', 'migration')
from (values ('gadgets', 'Gadgets', 60), ('wears', 'Wears', 70), ('electronics', 'Electronics', 80), ('vehicles', 'Vehicles', 90), ('repairs', 'Repairs', 100)) as c(slug, label, position)
where not exists (
  select 1 from public.admin_log l where l.action = 'category_create' and l.detail->>'slug' = c.slug
);
