import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanEmail, cleanPhone, hashValue, lookupHashes } from '../src/lib/scamReports.mjs';

test('emails and numbers are matched in one format', () => {
  assert.equal(cleanEmail(' Scam@Example.COM '), 'scam@example.com');
  assert.equal(cleanEmail('nope'), null);
  assert.equal(cleanPhone('+44 7700 900123'), '+447700900123');
  assert.equal(cleanPhone('0044 7700 900123'), '+447700900123');
  assert.equal(cleanPhone('0803 123 4567'), '08031234567');
  assert.equal(cleanPhone('123'), null);
  assert.ok(lookupHashes('+44 (7700) 900-123').includes(hashValue('+447700900123')));
  assert.ok(lookupHashes('08031234567').includes(hashValue('08031234567')));
  assert.deepEqual(lookupHashes('Scam@example.com'), [hashValue('scam@example.com')]);
});
