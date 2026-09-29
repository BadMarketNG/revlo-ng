-- Administrators can award any badge and remove any badge, including one the
-- publisher earned (2026-09-29). badge_override = 'none' means "no badge,
-- whatever the post count"; null still means "use the earned badge".
alter table public.revlo_publisher_stats drop constraint if exists revlo_publisher_stats_badge_override_check;
alter table public.revlo_publisher_stats add constraint revlo_publisher_stats_badge_override_check
  check (badge_override is null or badge_override in ('silver', 'bronze', 'gold', 'none'));
