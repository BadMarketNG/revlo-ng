-- Telegram partner channels (2026-10-02). A channel owner adds the Revlo bot to their channel; Revlo
-- approves the channel; its new posts are then published as Revlo posts (with the owner's permission).
create table if not exists public.revlo_telegram_channels (
  chat_id bigint primary key,
  title text,
  username text,
  chat_type text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paused', 'removed')),
  default_category text not null default 'general',
  default_area text not null default 'Nigeria',
  duration text not null default 'now' check (duration in ('now', '1m')),
  credit boolean not null default true,
  credit_name text,
  contact_email text,
  added_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.revlo_telegram_posts (
  chat_id bigint not null,
  message_id bigint not null,
  media_group_id text,
  post_uid text,
  imported_at timestamptz not null default now(),
  primary key (chat_id, message_id)
);
create index if not exists revlo_telegram_posts_recent_idx on public.revlo_telegram_posts (chat_id, imported_at desc);
create unique index if not exists revlo_telegram_posts_album_idx on public.revlo_telegram_posts (chat_id, media_group_id) where media_group_id is not null;

alter table public.revlo_telegram_channels enable row level security;
alter table public.revlo_telegram_posts enable row level security;
-- No policies: only the server (service role) reads or writes these tables.
