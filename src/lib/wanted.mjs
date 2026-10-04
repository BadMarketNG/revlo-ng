export const WANTED_CATEGORIES = ['for_sale', 'rentals', 'general', 'jobs'];
export const WANTED_LIFETIME_MS = 72 * 60 * 60 * 1000;

export function cleanWanted(input, now = Date.now()) {
  if (!WANTED_CATEGORIES.includes(input?.category)) return { error: 'Choose an item, rental, service or work.' };
  if (input?.contact_visibility !== 'public') return { error: 'Allow replies so people can respond to your request.' };
  if (input?.media_type !== 'images' || input?.video_url || input?.header_url || input?.thumb_url || input?.gallery?.length) {
    return { error: 'Wanted requests are text-only for now.' };
  }
  if (input?.booking) return { error: 'Wanted requests do not take bookings.' };
  if (input?.promo_payment_reference || input?.premium_payment_reference) return { error: 'Wanted requests are free.' };
  const budget = input?.budget_max === '' || input?.budget_max == null ? null : Number(input.budget_max);
  if (budget !== null && (!Number.isFinite(budget) || budget <= 0 || budget > 9999999999.99 || Math.abs(Math.round(budget * 100) - budget * 100) > 0.000001)) {
    return { error: 'Enter a valid maximum budget in naira.' };
  }
  const deadline = new Date(input?.needed_by || '').getTime();
  if (!Number.isFinite(deadline) || deadline < now + 60 * 60 * 1000 || deadline > now + WANTED_LIFETIME_MS) {
    return { error: 'Choose a deadline between one hour and three days from now.' };
  }
  return { budget_max: budget, needed_by: new Date(deadline).toISOString(), expires_at: new Date(deadline).toISOString() };
}
