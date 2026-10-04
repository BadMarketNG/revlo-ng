import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSlots, bookingSettingsFor } from '../src/lib/bookings.mjs';

test('rentals and vehicles without saved hours accept proposed viewings', () => {
  for (const category of ['rentals', 'vehicles']) {
    const settings = bookingSettingsFor({ category }, null);
    assert.equal(settings.proposed, true);
    assert.deepEqual(settings.modes, ['viewing']);
    assert.ok(availableSlots(settings, { now: Date.parse('2026-10-04T12:00:00Z'), expiresAt: '2026-10-11T12:00:00Z' }).length > 0);
  }
  assert.equal(bookingSettingsFor({ category: 'jobs' }, null), null);
});

test('seller hours take precedence over proposed defaults', () => {
  const saved = { modes: ['call'], days: [1], start_time: '10:00', end_time: '11:00', slot_minutes: 30 };
  assert.deepEqual(bookingSettingsFor({ category: 'vehicles' }, saved), { ...saved, proposed: false });
});
