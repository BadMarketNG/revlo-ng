import assert from 'node:assert/strict';
import test from 'node:test';
import { isBlockedContentCrawler, isScriptedPublicReader } from '../src/lib/botPolicy.mjs';

test('blocks named content and AI crawlers', () => {
  assert.equal(isBlockedContentCrawler('Mozilla/5.0 compatible; GPTBot/1.2'), true);
  assert.equal(isBlockedContentCrawler('ClaudeBot/1.0'), true);
  assert.equal(isBlockedContentCrawler('Googlebot/2.1'), false);
  assert.equal(isBlockedContentCrawler('Twitterbot/1.0'), false);
});

test('blocks common scripted clients on public data endpoints', () => {
  assert.equal(isScriptedPublicReader('curl/8.7.1'), true);
  assert.equal(isScriptedPublicReader('python-requests/2.32'), true);
  assert.equal(isScriptedPublicReader('Mozilla/5.0 Chrome/140 Safari/537.36'), false);
});
