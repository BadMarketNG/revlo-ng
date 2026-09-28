import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { detectUploadType, requiredSecret, serializeJsonForHtml } from '../src/lib/securityPrimitives.mjs';

test('JSON-LD serialization cannot close its script element', () => {
  const serialized = serializeJsonForHtml({ title: 'x</script><script>alert(1)</script>&' });
  assert.equal(serialized.includes('</script>'), false);
  assert.match(serialized, /\\u003c\/script\\u003e/);
  assert.match(serialized, /\\u0026/);
});

test('upload detection uses bytes rather than a supplied filename or MIME type', () => {
  assert.equal(detectUploadType(Buffer.from('{"not":"an image"}')), null);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(8),
  ]);
  assert.deepEqual(detectUploadType(png), { mime: 'image/png', extension: 'png' });
});

test('security secrets fail closed when absent or weak', () => {
  const previous = process.env.REVLO_TEST_SECRET;
  delete process.env.REVLO_TEST_SECRET;
  assert.throws(() => requiredSecret('REVLO_TEST_SECRET'), /must be configured/);
  process.env.REVLO_TEST_SECRET = 'short';
  assert.throws(() => requiredSecret('REVLO_TEST_SECRET'), /must be configured/);
  process.env.REVLO_TEST_SECRET = 'a'.repeat(32);
  assert.equal(requiredSecret('REVLO_TEST_SECRET'), 'a'.repeat(32));
  if (previous == null) delete process.env.REVLO_TEST_SECRET;
  else process.env.REVLO_TEST_SECRET = previous;
});

test('administrator cookies use the asynchronous Next.js request boundary', () => {
  const source = readFileSync('src/lib/adminAuth.js', 'utf8');
  assert.match(source, /const cookieStore = await cookies\(\)/);
  assert.match(source, /cookieStore\.get\(COOKIE\)/);
  assert.doesNotMatch(source, /cookies\(\)\.get\(/);
});
