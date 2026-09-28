-- Atomic, idempotent Premium Green fulfilment. Kept separate because the
-- feature schema migration was already applied before this hardening step.
create or replace function public.fulfil_revlo_premium_payment(p_reference text, p_email text, p_days integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  payment public.revlo_payment_intents%rowtype;
  current_until timestamptz;
begin
  select * into payment from public.revlo_payment_intents where reference = p_reference for update;
  if not found or payment.email <> lower(trim(p_email)) or payment.kind <> 'premium' then return false; end if;
  if payment.fulfilled_at is not null then return true; end if;
  select active_until into current_until from public.revlo_premium_badges where email = payment.email for update;
  current_until := greatest(coalesce(current_until, now()), now()) + make_interval(days => p_days);
  insert into public.revlo_premium_badges (email, active_until, payment_reference, updated_at)
  values (payment.email, current_until, payment.reference, now())
  on conflict (email) do update set active_until = excluded.active_until, payment_reference = excluded.payment_reference, updated_at = now();
  update public.revlo_payment_intents set status = 'paid', fulfilled_at = now() where reference = payment.reference;
  return true;
end;
$$;
revoke execute on function public.fulfil_revlo_premium_payment(text,text,integer) from public, anon, authenticated;
grant execute on function public.fulfil_revlo_premium_payment(text,text,integer) to service_role;

-- Existing live posts receive the publisher's earned level immediately.
update public.posts p
set trust_badge = case
  when s.badge_override is not null then s.badge_override
  when s.published_posts >= f.gold_posts then 'gold'
  when s.published_posts >= f.bronze_posts then 'bronze'
  when s.published_posts >= f.silver_posts then 'silver'
  else null
end
from public.revlo_publisher_stats s
cross join public.revlo_feature_settings f
where lower(p.poster_email) = s.email;

update public.posts p set premium_badge = true
from public.revlo_premium_badges b
where lower(p.poster_email) = b.email and b.active_until > now();
