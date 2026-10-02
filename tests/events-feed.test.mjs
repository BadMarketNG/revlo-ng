import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../src/lib/eventsFeed.mjs';

test('events feed is valid iCalendar with escaped, folded text', () => {
  const ics = buildIcs([{ uid: 'AB12CD', title: 'Acoustic night; live, close seats', summary: 'Music', start: '2026-10-12T19:00:00+01:00', end: null, venue: 'Freedom Park', location: 'Lagos, Nigeria', url: 'https://revlo.ng/p/AB12CD', created_at: '2026-10-02T10:00:00Z' }]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261012T180000Z/);
  assert.match(ics, /DTEND:20261012T200000Z/);
  assert.match(ics, /SUMMARY:Acoustic night\; live\\, close seats/);
  assert.ok(ics.split('\r\n').every(line => Buffer.byteLength(line) <= 75));
  assert.match(ics, /END:VCALENDAR\r\n$/);
});
