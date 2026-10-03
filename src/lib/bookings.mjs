// Book a viewing or call (2026-10-02): availability, slots and validation. All times are Lagos time
// (UTC+1 all year, no daylight saving).

// 2026-10-02 (later): Promotions too (reservations, visits); booking is always the poster's choice.
export const BOOKING_CATEGORIES = ['rentals', 'for_sale', 'vehicles', 'promotions'];
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86400000;
const LAGOS_OFFSET_MS = 3600000;
export const BOOKING_DAYS_AHEAD = 14;
export const MIN_NOTICE_MS = 2 * 3600000; // no bookings starting within two hours

const minutes = t => { const m = HHMM.exec(t); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** Cleans the poster's availability from the post form; null when booking is off or invalid. */
export function cleanBookingSettings(input, category) {
  if (!input || !BOOKING_CATEGORIES.includes(category)) return null;
  const modes = ['viewing', 'call'].filter(m => Array.isArray(input.modes) && input.modes.includes(m));
  const days = [...new Set((Array.isArray(input.days) ? input.days : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const start = minutes(input.start_time), end = minutes(input.end_time);
  const slot = [15, 30, 60].includes(Number(input.slot_minutes)) ? Number(input.slot_minutes) : 30;
  if (!modes.length || !days.length || start == null || end == null || end - start < slot) return null;
  return { modes, days, start_time: input.start_time, end_time: input.end_time, slot_minutes: slot };
}

/** Bookable slot start times (ISO, UTC) from `now` until the post expires or 14 days, minus taken ones. */
export function availableSlots(settings, { now = Date.now(), expiresAt, taken = [] }) {
  if (!settings) return [];
  const takenSet = new Set(taken.map(t => new Date(t).getTime()));
  const until = Math.min(now + BOOKING_DAYS_AHEAD * DAY_MS, expiresAt ? new Date(expiresAt).getTime() : Infinity);
  const start = minutes(settings.start_time), end = minutes(settings.end_time), step = settings.slot_minutes;
  const out = [];
  // Midnight today in Lagos, as a UTC timestamp.
  const lagosMidnight = Math.floor((now + LAGOS_OFFSET_MS) / DAY_MS) * DAY_MS - LAGOS_OFFSET_MS;
  for (let day = 0; day <= BOOKING_DAYS_AHEAD; day += 1) {
    const midnight = lagosMidnight + day * DAY_MS;
    const weekday = new Date(midnight + LAGOS_OFFSET_MS).getUTCDay();
    if (!settings.days.includes(weekday)) continue;
    for (let m = start; m + step <= end; m += step) {
      const t = midnight + m * 60000;
      if (t < now + MIN_NOTICE_MS || t > until || takenSet.has(t)) continue;
      out.push(new Date(t).toISOString());
    }
  }
  return out;
}

/** Validates a visitor's booking request; returns { value } or { error }. */
export function cleanBookingRequest(body) {
  const name = String(body?.name || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const email = String(body?.email || '').trim().toLowerCase();
  const phone = String(body?.phone || '').replace(/[^\d+]/g, '');
  const note = String(body?.note || '').replace(/\s+/g, ' ').trim().slice(0, 300) || null;
  const mode = body?.mode === 'call' ? 'call' : body?.mode === 'viewing' ? 'viewing' : null;
  const slot = Date.parse(body?.slot);
  if (!mode) return { error: 'Choose a viewing or a call.' };
  if (name.length < 2) return { error: 'Enter your name.' };
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) return { error: 'Enter a valid email address.' };
  if (!/^\+?\d{10,15}$/.test(phone)) return { error: 'Enter a phone number the poster can reach you on.' };
  if (!Number.isFinite(slot)) return { error: 'Choose a time.' };
  return { value: { name, email, phone, note, mode, slot: new Date(slot).toISOString() } };
}

/** "Sat 12 Oct, 6:30 pm" in Lagos time. */
export function lagosLabel(iso) {
  const d = new Date(new Date(iso).getTime() + LAGOS_OFFSET_MS);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}, ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export const SAFETY_LINES = [
  'Never pay anything — no “inspection fee”, deposit or transfer — before you have seen the place or item in person.',
  'Meet in daylight in a public or busy place, and take someone with you to viewings.',
  'Check documents and ownership before any payment, and never share bank PINs or codes.',
  'If something feels wrong, leave, and report the post on Revlo.',
];
