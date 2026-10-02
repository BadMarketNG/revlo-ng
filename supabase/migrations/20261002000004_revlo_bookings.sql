-- Book a viewing or call (2026-10-02). Posters of Rentals and For Sale posts can offer times for calls
-- and/or viewings; visitors request a slot, confirm by email, and the poster accepts or declines.
-- Also: structured listing details (rent, bedrooms, price…) for filters and card badges.

create table if not exists public.revlo_booking_settings (
  post_uid text primary key,
  modes text[] not null default '{viewing,call}',
  days smallint[] not null default '{1,2,3,4,5,6}',   -- 0 = Sunday … 6 = Saturday (Lagos time)
  start_time text not null default '10:00',            -- HH:MM, Lagos time
  end_time text not null default '17:00',
  slot_minutes smallint not null default 30,
  created_at timestamptz not null default now(),
  constraint revlo_booking_modes check (modes <@ array['viewing','call']::text[] and cardinality(modes) > 0),
  constraint revlo_booking_slot check (slot_minutes in (15, 30, 60))
);

create table if not exists public.revlo_bookings (
  id uuid primary key default gen_random_uuid(),
  post_uid text not null,
  mode text not null check (mode in ('viewing', 'call')),
  slot_start timestamptz not null,
  name text not null,
  email text not null,
  phone text not null,
  note text,
  -- unconfirmed: visitor has not opened the email link yet; requested: waiting for the poster;
  -- accepted / declined / cancelled: final states.
  status text not null default 'unconfirmed' check (status in ('unconfirmed', 'requested', 'accepted', 'declined', 'cancelled')),
  visitor_token text not null unique,
  poster_token text not null unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  decided_at timestamptz,
  reminded_at timestamptz
);
-- A slot can be held by only one live request or booking.
create unique index if not exists revlo_bookings_slot_taken on public.revlo_bookings (post_uid, slot_start) where status in ('requested', 'accepted');
create index if not exists revlo_bookings_post_idx on public.revlo_bookings (post_uid, slot_start);
create index if not exists revlo_bookings_email_idx on public.revlo_bookings (lower(email), created_at);

create table if not exists public.revlo_post_details (
  post_uid text primary key,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.revlo_booking_settings enable row level security;
alter table public.revlo_bookings enable row level security;
alter table public.revlo_post_details enable row level security;
-- No policies: only the server (service role) reads or writes these tables.
