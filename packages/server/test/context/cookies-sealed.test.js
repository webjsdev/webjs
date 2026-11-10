/**
 * cookies() writes are applied to the response once, when its headers are
 * decided. A write after that (a component inside a streamed Suspense region)
 * could never reach the browser, so it throws naming the fix instead of being
 * silently dropped, the way Next refuses a cookie write during render.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { withRequest, cookies, sealCookies } from '../../src/context.js';
import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString());
const SERVER = JSON.stringify(pathToFileURL(resolve(__dirname, '../../index.js')).toString());

test('a sealed store refuses writes and still reads', async () => {
  await withRequest(new Request('http://x/', { headers: { cookie: 'a=1' } }), async () => {
    (await cookies()).set('b', '2');
    sealCookies();
    const jar = await cookies();
    assert.equal(jar.get('a')?.value, '1', 'reads still work');
    assert.throws(() => jar.set('c', '3'), /after the response headers were sent/);
    assert.throws(() => jar.delete('a'), /after the response headers were sent/);
  });
  await withRequest(new Request('http://x/'), async () => {
    sealCookies();
    assert.throws(() => cookies().set('late', '1'), /after the response headers were sent/, 'a store first touched after the seal is sealed too');
  });
});

test('a cookie write inside a streamed region is refused loudly, not dropped', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-cookie-seal-'));
  const files = {
    'package.json': '{"name":"c","type":"module"}',
    'app/page.js': `import { html, Suspense } from ${CORE};
import { cookies } from ${SERVER};
async function late() {
  await new Promise((r) => setTimeout(r, 30));
  try { (await cookies()).set('late', '1'); return html\`<p>set</p>\`; }
  catch (e) { return html\`<p id="refused">\${e.message}</p>\`; }
}
export default async () => {
  (await cookies()).set('early', '1');
  return html\`<main>\${Suspense({ fallback: html\`<p>loading</p>\`, children: late() })}</main>\`;
};
`,
  };
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  try {
    const h = await createRequestHandler({ appDir: dir, dev: true, logger: { info() {}, warn() {}, error() {} } });
    await h.warmup?.();
    const res = await h.handle(new Request('http://x/'));
    const set = res.headers.getSetCookie().join('\n');
    assert.match(set, /^early=1/m, 'a write before the headers go out is applied');
    assert.doesNotMatch(set, /late=/, 'a write after cannot be');
    const body = await res.text();
    assert.match(body, /after the response headers were sent/, 'the late write fails where the author can see it');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
