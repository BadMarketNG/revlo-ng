-- X feed admin (2026-10-03): searches and budget editable in the Revlo admin. Settings left empty fall
-- back to the Vercel environment values (X_FEED_ENABLED, X_FEED_DAILY_POSTS, X_FEED_PERIOD_DAYS,
-- X_FEED_MONTHLY_USD, X_PRICE_PER_POST).
create table if not exists public.revlo_x_settings (
  id boolean primary key default true check (id),
  enabled boolean,
  period_posts integer check (period_posts is null or period_posts between 10 and 100000),
  period_days integer check (period_days is null or period_days between 1 and 31),
  monthly_usd numeric check (monthly_usd is null or monthly_usd >= 0),
  price_per_post numeric check (price_per_post is null or price_per_post > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.revlo_x_searches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,               -- the Revlo category its posts go into
  terms text not null,                  -- X search words (X search syntax)
  match_words text not null default '', -- a post is published only if its text has one of these (comma-separated)
  cities text[] not null default '{Lagos,Abuja,"Port Harcourt"}',
  national boolean not null default false, -- national searches run once and skip the city check
  enabled boolean not null default true,
  position integer not null default 100,
  created_at timestamptz not null default now()
);

alter table public.revlo_x_posts add column if not exists search_id uuid;

-- The four searches running today.
insert into public.revlo_x_searches (name, category, terms, match_words, cities, national, position)
select * from (values
  ('Jobs', 'jobs', '(hiring OR vacancy OR "job opening" OR "we are recruiting")', 'hiring, vacancy, vacancies, job opening, recruiting, apply', '{Lagos,Abuja,"Port Harcourt"}'::text[], false, 10),
  ('Rent', 'rentals', '("to let" OR "for rent" OR "apartment for rent" OR "self contain" OR shortlet)', 'to let, for rent, apartment, self contain, self-contain, shortlet, bedroom, flat', '{Lagos,Abuja,"Port Harcourt"}'::text[], false, 20),
  ('Items for sale', 'for_sale', '("for sale" OR selling OR "now selling" OR "dm for price") (phone OR laptop OR car OR shoes OR clothes OR tv OR generator OR furniture OR iphone)', 'for sale, selling, price, ₦, naira, dm for price', '{Lagos,Abuja,"Port Harcourt"}'::text[], false, 30),
  ('Politics (news outlets)', 'general', '(from:PremiumTimesng OR from:channelstv OR from:MobilePunch OR from:vanguardngrnews OR from:TheCableng OR from:BBCNewsPidgin OR from:ARISEtv) (election OR senate OR governor OR president OR INEC OR assembly OR minister OR party OR tinubu OR policy)', 'election, senate, senator, governor, president, presidency, inec, assembly, minister, party, tinubu, policy, lawmakers, reps', '{Nigeria}'::text[], true, 40)
) as seed(name, category, terms, match_words, cities, national, position)
where not exists (select 1 from public.revlo_x_searches);

alter table public.revlo_x_settings enable row level security;
alter table public.revlo_x_searches enable row level security;
-- No policies: only the server (service role) reads or writes these tables.
