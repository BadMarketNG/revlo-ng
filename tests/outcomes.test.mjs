import test from 'node:test';
import assert from 'node:assert/strict';
import { duration, headline, outcomeFor, resultLabel } from '../src/lib/outcomes.mjs';

test('result wording is honest and rounded down', () => {
  assert.equal(duration(0.4), 'under an hour');
  assert.equal(duration(1.9), '1 hour');
  assert.equal(duration(3.99), '3 hours');
  assert.equal(duration(71), '2 days');
  assert.equal(outcomeFor('rentals').outcome, 'let');
  assert.equal(headline('let', 3.2), 'Let in 3 hours');
  assert.equal(resultLabel({ title: 'Bright two-bedroom flat in Yaba', location: 'Lagos, Nigeria' }), 'Bright two-bedroom flat in Yaba · Lagos');
  assert.equal(resultLabel({ title: 'Sofa in Lagos', location: 'Lagos, Nigeria' }), 'Sofa in Lagos');
});
