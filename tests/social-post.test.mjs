import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDigest, buildShortDigest, oauth1Header } from '../src/lib/socialPost.mjs';

// The expected value is HMAC-SHA1 of the signature base string published in X's OAuth docs, computed
// independently, so this checks that the base string is built exactly as documented.
test('OAuth 1.0a signature uses the documented base string', () => {
  const header = oauth1Header({
    method: 'POST', url: 'https://api.twitter.com/1.1/statuses/update.json',
    params: { include_entities: 'true', status: 'Hello Ladies + Gentlemen, a signed OAuth request!' },
    consumerKey: 'xvz1evFS4wEEPTGEFPHBog', consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
    token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS6weJAEb', tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
    nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', timestamp: 1318622958,
  });
  assert.match(header, /oauth_signature="0qzObXuXUG9S0zNhSb65UCAFBpc%3D"/);
});

test('daily digests', () => {
  const text = buildDigest({ jobs: 12, rentals: 1, for_sale: 0 }, { bookable: 1 });
  assert.match(text, /^Today on Revlo: 13 new posts across Nigeria/);
  assert.match(text, /• 12 jobs\n• 1 room or rental/);
  assert.match(text, /📅 1 you can book/);
  assert.doesNotMatch(text, /jooble/i);
  assert.equal(buildDigest({}), null);
  const short = buildShortDigest({ jobs: 12, rentals: 5 });
  assert.ok(short.length <= 280);
  assert.match(short, /12 jobs, 5 rooms and rentals/);
});
