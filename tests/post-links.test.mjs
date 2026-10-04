import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPostLink, postWithoutLinks, stripPostLinks } from '../src/lib/postLinks.mjs';
import { xToPost } from '../src/lib/xFeed.mjs';
import { telegramToPost } from '../src/lib/telegramImport.mjs';

test('blocks common outbound URL forms in publisher text', () => {
  for (const link of ['https://t.co/ZXnIDAida6', 'http://example.com/path', 'www.example.ng', 'short.ly/abc', 'https://x.com/a/status/1']) {
    assert.equal(hasPostLink(`See ${link}`), true, link);
    assert.equal(hasPostLink(stripPostLinks(`See ${link}`)), false, link);
  }
  assert.equal(hasPostLink('C of O land title; 5 units, Lagos'), false);
  assert.equal(hasPostLink('Write to support@revlo.ng'), false);
  assert.equal(stripPostLinks('Write to support@revlo.ng'), 'Write to support@revlo.ng');
});

test('removes links already present in a post without changing other fields', () => {
  const post = { uid: 'RV-LZNF9G', title: 'Land sale', description: '6 staff buildings https://t.co/ZXnIDAida6\n\n#for sale', location: 'Lagos, Nigeria', header_url: 'https://images.example.com/image.jpg' };
  const cleaned = postWithoutLinks(post);
  assert.equal(cleaned.description, '6 staff buildings\n\n#for sale');
  assert.equal(cleaned.header_url, post.header_url);
});

test('imported X and Telegram post copy has no outside links', () => {
  const x = xToPost({ id: '123', category: 'for_sale', city: 'Lagos', text: 'Car for sale in Lagos https://t.co/abc', author_username: 'seller' });
  assert.equal(hasPostLink(x.title, x.description), false);
  const telegram = telegramToPost({ text: 'Car for sale https://example.com/car\nSee www.example.com' }, { default_category: 'for_sale', default_area: 'Lagos, Nigeria', credit: false });
  assert.equal(hasPostLink(telegram.title, telegram.description), false);
});
