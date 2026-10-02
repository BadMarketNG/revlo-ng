import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSlots, cleanBookingRequest, cleanBookingSettings, lagosLabel } from '../src/lib/bookings.mjs';

const settings = cleanBookingSettings({ modes: ['viewing', 'call', 'hack'], days: [6, 1, 9], start_time: '10:00', end_time: '12:00', slot_minutes: 60 }, 'rentals');

test('settings are cleaned and only for rentals and for sale', () => {
  assert.deepEqual(settings, { modes: ['viewing', 'call'], days: [1, 6], start_time: '10:00', end_time: '12:00', slot_minutes: 60 });
  assert.equal(cleanBookingSettings({ modes: ['call'], days: [1], start_time: '10:00', end_time: '12:00' }, 'jobs'), null);
  assert.equal(cleanBookingSettings({ modes: ['call'], days: [1], start_time: '12:00', end_time: '10:00' }, 'rentals'), null);
});

test('slots follow Lagos time, skip taken slots, short notice and expiry', () => {
  const now = Date.parse('2026-10-03T07:30:00Z'); // Saturday 8:30 am in Lagos
  const slots = availableSlots(settings, { now, expiresAt: '2026-10-06T00:00:00Z', taken: ['2026-10-05T09:00:00Z'] });
  // Sat 10:00 is too soon (within two hours); Sat 11:00 Lagos = 10:00Z; Mon 10:00 Lagos = 09:00Z is taken; Mon 11:00 Lagos = 10:00Z.
  assert.deepEqual(slots, ['2026-10-03T10:00:00.000Z', '2026-10-05T10:00:00.000Z']);
  assert.equal(lagosLabel('2026-10-05T10:00:00.000Z'), 'Mon 5 Oct, 11:00 am');
});

test('booking requests are validated', () => {
  assert.ok(cleanBookingRequest({ mode: 'viewing', name: 'Ada', email: 'a@b.ng', phone: '0803 123 4567', slot: '2026-10-05T10:00:00Z' }).value);
  assert.match(cleanBookingRequest({ mode: 'viewing', name: 'Ada', email: 'a@b.ng', phone: '12', slot: 'x' }).error, /phone/);
});
