-- Keep up to three original photos from an X post. The first remains the
-- header image; the other two are shown in the existing Revlo gallery.
alter table public.revlo_x_posts add column if not exists media_urls text[] not null default '{}';
