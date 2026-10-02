-- Search ticker (2026-10-02): counts what people search for so the search bar's ticker can show a
-- mix of the most searched, the newest and everything in between. Only terms that are real post
-- tags (or the starter list) are ever shown publicly; any term can be counted.
-- The score decays by half every 72 hours, so recent interest matters more than old totals.

create table if not exists public.revlo_search_terms (
  term text primary key check (char_length(term) between 2 and 32),
  search_count bigint not null default 0,
  score double precision not null default 0,
  score_at timestamptz not null default now(),
  first_searched_at timestamptz not null default now(),
  last_searched_at timestamptz not null default now()
);
create index if not exists revlo_search_terms_last_idx on public.revlo_search_terms (last_searched_at desc);
alter table public.revlo_search_terms enable row level security;

create or replace function public.revlo_record_search(p_term text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.revlo_search_terms as t (term, search_count, score, score_at)
  values (p_term, 1, 1, now())
  on conflict (term) do update set
    search_count = t.search_count + 1,
    score = t.score * power(0.5, extract(epoch from (now() - t.score_at)) / (72 * 3600)) + 1,
    score_at = now(),
    last_searched_at = now();
end
$$;
revoke all on function public.revlo_record_search(text) from public, anon, authenticated;
