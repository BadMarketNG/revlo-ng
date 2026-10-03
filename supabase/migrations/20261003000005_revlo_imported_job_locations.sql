-- Imported jobs used the partner's place names ("Lagos, Lagos State"), which Revlo's location filter
-- (exact names like "Lagos, Nigeria") did not match, so they disappeared when a city was selected.
-- New imports now use Revlo's names; this corrects the ones already live. (2026-10-03)
update public.posts set location = case
  when location ilike '%lagos%' then 'Lagos, Nigeria'
  when location ilike '%abuja%' or location ilike '%fct%' then 'Abuja FCT'
  when location ilike '%port harcourt%' then 'Port Harcourt, Rivers'
  when location ilike '%ibadan%' then 'Ibadan, Oyo State'
  when location ilike '%kano%' then 'Kano, Kano State'
  when location ilike '%enugu%' then 'Enugu, Enugu State'
  when location ilike '%kaduna%' then 'Kaduna, Kaduna State'
  when location ilike '%benin%' then 'Benin City, Edo State'
  else location end
where poster_email = 'support@revlo.ng' and category = 'jobs' and deleted_at is null and expires_at > now();
