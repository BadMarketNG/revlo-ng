-- Badge order (2026-10-03, owner's request): Bronze < Silver < Gold. Previously Silver was the first badge
-- (100 posts) and Bronze the second (500). Swap the administrator-set thresholds and publish-link
-- allowances so Bronze needs fewer posts than Silver. Only swaps when they are still in the old order.
update public.revlo_feature_settings
set bronze_posts = silver_posts, silver_posts = bronze_posts
where bronze_posts > silver_posts;

update public.revlo_feature_settings
set bronze_link_posts = silver_link_posts, silver_link_posts = bronze_link_posts
where bronze_link_posts > silver_link_posts;

-- Live posts show the badge their publisher holds under the new order (same one-time refresh as
-- 20260928000003, with Silver now above Bronze). Administrator overrides are kept.
update public.posts p
set trust_badge = case
  when s.badge_override = 'none' then null
  when s.badge_override is not null then s.badge_override
  when s.published_posts >= f.gold_posts then 'gold'
  when s.published_posts >= f.silver_posts then 'silver'
  when s.published_posts >= f.bronze_posts then 'bronze'
  else null
end
from public.revlo_publisher_stats s
cross join public.revlo_feature_settings f
where lower(p.poster_email) = s.email
  and p.expires_at > now();
