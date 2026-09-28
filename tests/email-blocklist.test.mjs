import test from 'node:test';
import assert from 'node:assert/strict';
import {
  domainIsListed,
  emailDomain,
  normaliseDomain,
  normaliseEmailRule,
  wildcardCandidates,
} from '../src/lib/emailBlocklistPrimitives.mjs';

const normaliseEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';

test('normalises exact and whole-domain administrator rules', () => {
  assert.equal(normaliseEmailRule(' Person@Bill.com ', normaliseEmail), 'person@bill.com');
  assert.equal(normaliseEmailRule('*@Bill.com', normaliseEmail), '*@bill.com');
  assert.equal(normaliseEmailRule('@Bill.com', normaliseEmail), '*@bill.com');
  assert.equal(normaliseEmailRule('*@not a domain', normaliseEmail), '');
});

test('normalises international domains to ASCII and rejects unsafe domain syntax', () => {
  assert.equal(normaliseDomain('BÜCHER.de'), 'xn--bcher-kva.de');
  assert.equal(normaliseDomain('*.example.com'), '');
  assert.equal(normaliseDomain('com'), '');
});

test('builds wildcard candidates without ever matching a bare top-level domain', () => {
  assert.deepEqual(wildcardCandidates('user@mail.eu.example.com'), [
    '*@mail.eu.example.com',
    '*@eu.example.com',
    '*@example.com',
  ]);
  assert.ok(!wildcardCandidates('user@example.com').includes('*@com'));
});

test('matches a listed disposable domain and its mail subdomains', () => {
  const domains = new Set(['throwaway.example']);
  assert.equal(domainIsListed('a@throwaway.example', domains), true);
  assert.equal(domainIsListed('a@mail.throwaway.example', domains), true);
  assert.equal(domainIsListed('a@safe.example', domains), false);
  assert.equal(emailDomain('a@MAIL.Throwaway.Example'), 'mail.throwaway.example');
});
