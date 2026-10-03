-- X posts become Revlo posts (2026-10-03): each cached X post records the Revlo post created from it.
alter table public.revlo_x_posts add column if not exists post_uid text;
create index if not exists revlo_x_posts_post_uid_idx on public.revlo_x_posts (post_uid);
-- The post's second photo, or the author's profile picture, used as the Revlo post's icon.
alter table public.revlo_x_posts add column if not exists icon_url text;
