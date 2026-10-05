-- Vehicles are ordinary For Sale listings. Preserve existing posts and alerts.
update public.posts set category = 'for_sale' where category = 'vehicles';
update public.revlo_alerts set category = 'for_sale' where category = 'vehicles';
update public.revlo_promotions set category = 'for_sale' where category = 'vehicles';
update public.revlo_x_posts set category = 'for_sale' where category = 'vehicles';
update public.revlo_x_searches set category = 'for_sale' where category = 'vehicles';

insert into public.admin_log (action, target_uid, detail)
select 'category_delete', 'category:vehicles',
  jsonb_build_object('slug', 'vehicles', 'label', 'Vehicles', 'reassigned_to', 'for_sale', 'administrator_email', 'migration')
where not exists (
  select 1 from public.admin_log
  where action = 'category_delete' and detail->>'slug' = 'vehicles'
);
