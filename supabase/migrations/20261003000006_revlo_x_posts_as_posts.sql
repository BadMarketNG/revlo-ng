-- X posts become Revlo posts (2026-10-03): each cached X post records the Revlo post created from it.
alter table public.revlo_x_posts add column if not exists post_uid text;
create index if not exists revlo_x_posts_post_uid_idx on public.revlo_x_posts (post_uid);
