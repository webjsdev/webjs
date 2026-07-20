/**
 * Cross-runtime proof of the keyed children-boundary SSR emission (#1015).
 * Runs under WHICHEVER runtime executes it (Bun via the CI `bun` job /
 * `bun test/bun/keyed-boundaries.mjs`, Node via the `.test.mjs` wrapper in
 * `npm test`).
 *
 * The emission is runtime-sensitive surface: it rides the SSR string path
 * (renderToString + the synthetic-template `strings` walk) that the Bun
 * listener shell serves, and the route-key encodes user-controlled param
 * values (`encodeURIComponent` per path piece), so a runtime divergence in
 * either would silently change the wire format the client router pairs on.
 * Asserts on a real app boot + real GETs:
 *   - each layout children slot carries the keyed pair
 *     (open `wj:children:<segment>:<route-key>`, close `/wj:children:<segment>`)
 *   - the page-level boundary exists with the RESOLVED route-key
 *   - a param value that could terminate the comment (`-->`) is encoded
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRequestHandler } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
// The tmp app has no node_modules, so its modules import the core html tag by
// absolute file URL (the same pattern the server unit fixtures use).
const HTML_URL = pathToFileURL(resolve(
  dirname(fileURLToPath(import.meta.url)), '../../packages/core/src/html.js',
)).toString();

const dir = mkdtempSync(join(tmpdir(), 'webjs-bun-boundaries-'));
try {
  const appDir = join(dir, 'app');
  mkdirSync(join(appDir, 'blog', '[slug]'), { recursive: true });
  writeFileSync(join(dir, 'package.json'),
    JSON.stringify({ name: 'fx', type: 'module', imports: { '#*': './*' } }));
  writeFileSync(join(appDir, 'layout.ts'),
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `export default ({ children }: any) => html\`<div class="shell">\${children}</div>\`;\n`);
  writeFileSync(join(appDir, 'blog', '[slug]', 'page.ts'),
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `export default () => html\`<article>post</article>\`;\n`);

  const h = await createRequestHandler({ appDir: dir, dev: false });
  if (h.warmup) await h.warmup();

  // 1. A plain dynamic route: root layout boundary + page boundary, resolved key.
  {
    const res = await h.handle(new Request('http://localhost/blog/a'));
    assert.equal(res.status, 200, `GET /blog/a on ${runtime}`);
    const body = await res.text();
    assert.ok(body.includes('<!--wj:children:/:/-->'),
      `root layout keyed open boundary on ${runtime}`);
    assert.ok(body.includes('<!--/wj:children:/-->'),
      `root layout keyed close boundary on ${runtime}`);
    assert.ok(body.includes('<!--wj:children:/blog/[slug]:/blog/a-->'),
      `page boundary with the RESOLVED route-key on ${runtime}`);
    assert.ok(body.includes('<!--/wj:children:/blog/[slug]-->'),
      `page boundary keyed close on ${runtime}`);
  }

  // 2. A param value carrying '-->' must be encoded so it cannot terminate
  //    the boundary comment (the comment-injection guard).
  {
    const res = await h.handle(new Request('http://localhost/blog/a--%3Eb'));
    assert.equal(res.status, 200, `GET /blog/a--%3Eb on ${runtime}`);
    const body = await res.text();
    assert.ok(body.includes('<!--wj:children:/blog/[slug]:/blog/a--%3Eb-->'),
      `the decoded '-->' in the param is re-encoded in the route-key on ${runtime}`);
    assert.ok(!body.includes('<!--wj:children:/blog/[slug]:/blog/a-->b'),
      `an unencoded param must never terminate the boundary comment on ${runtime}`);
  }

  console.log(`[keyed-boundaries] OK on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
