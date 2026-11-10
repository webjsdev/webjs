// headers() is read-only, as Next.js's ReadonlyHeaders is (#1686): it returns
// the REQUEST headers, so a set() meant for the response used to vanish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRequest, headers } from '../../src/context.js';

const req = () => new Request('http://x/', { headers: { 'accept-language': 'fr', 'x-a': '1' } });

test('headers() reads the request headers, awaited or not', async () => {
  await withRequest(req(), async () => {
    assert.equal(headers().get('accept-language'), 'fr');
    assert.equal((await headers()).get('x-a'), '1');
    assert.deepEqual([...headers().keys()].sort(), ['accept-language', 'x-a']);
    assert.ok(headers() instanceof Headers);
  });
});

test('set, append and delete throw a ReadonlyHeadersError naming the fix', async () => {
  await withRequest(req(), async () => {
    for (const write of [(h) => h.set('x-b', '2'), (h) => h.append('x-b', '2'), (h) => h.delete('x-a')]) {
      assert.throws(() => write(headers()), (e) => e.name === 'ReadonlyHeadersError' && /cookies\(\)\.set\(\)/.test(e.message) && /route handler or middleware/.test(e.message));
    }
    assert.equal(headers().get('x-a'), '1', 'nothing changed');
    assert.equal(headers(), headers(), 'one object per request');
  });
});
