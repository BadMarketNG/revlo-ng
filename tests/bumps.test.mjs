import test from 'node:test';
import assert from 'node:assert/strict';
import { naira, pinBumped } from '../src/lib/bumps.mjs';

test('bumped posts go first, newest bump first, the rest keep their order', () => {
  const posts = ['a', 'b', 'c', 'd'].map(uid => ({ uid }));
  assert.deepEqual(pinBumped(posts, ['c', 'a']).map(p => p.uid), ['c', 'a', 'b', 'd']);
  assert.deepEqual(pinBumped(posts, []).map(p => p.uid), ['a', 'b', 'c', 'd']);
  assert.equal(naira(50000), '₦500');
});
