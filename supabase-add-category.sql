-- Revlo.ng post categories
-- Run this in the Supabase SQL Editor.

alter table posts add column if not exists category text not null default 'general';
create index if not exists posts_category_idx on posts (category);
