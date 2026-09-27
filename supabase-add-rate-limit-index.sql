-- Speeds up the per-email posting rate-limit check in /api/posts (POST).
-- Run this in the Supabase SQL Editor.

create index if not exists posts_poster_email_created_at_idx on posts (poster_email, created_at);
