/**
 * Cross-runtime proof for the dev embed bridge (#1498). Run under both:
 *
 *   node test/bun/dev-embed.mjs
 *   bun  test/bun/dev-embed.mjs
 *
 * The bridge rides the SSR head and the response-header merge, both on the
 * request path the Node and Bun listeners share, and the browser half is read
 * from disk at module load with `import.meta.url`. So under each runtime:
 * WEBJS_EMBED_ORIGINS in dev injects the nonce-signed script and drops
 * X-Frame-Options, and a production handler does neither. A plain assert
 * script (not `*.test.mjs`) that exits non-zero on failure.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequestHandler } from '../../packages/server/src/dev.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const appDir = mkdtempSync(join(tmpdir(), 'webjs-bun-embed-'));
const saved = process.env.WEBJS_EMBED_ORIGINS;
try {
  mkdirSync(join(appDir, 'app'), { recursive: true });
  writeFileSync(join(appDir, 'app/page.js'), "export default function P() { return '<h1>hi</h1>'; }\n");
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'embed', type: 'module', webjs: { csp: true } }));
  process.env.WEBJS_EMBED_ORIGINS = 'https://host.example';

  const dev = await createRequestHandler({ appDir, dev: true });
  const res = await dev.handle(new Request('http://localhost/'));
  const html = await res.text();
  const csp = res.headers.get('content-security-policy') || '';
  const nonce = (/nonce-([^']+)/.exec(csp) || [])[1];
  assert.ok(nonce, `[${runtime}] CSP nonce minted`);
  assert.ok(html.includes(`<script nonce="${nonce}" data-webjs-embed>`), `[${runtime}] bridge script is nonce-signed`);
  assert.ok(html.includes('installEmbedBridge(["https://host.example"])'), `[${runtime}] origins inlined`);
  assert.equal(res.headers.get('x-frame-options'), null, `[${runtime}] X-Frame-Options dropped in dev`);
  assert.match(csp, /frame-ancestors 'self' https:\/\/host\.example/, `[${runtime}] frame-ancestors widened`);
  // The host's reload hold (#1532): the bridge handles the command, and the
  // served reload client gates every reload on it.
  assert.ok(html.includes("d.type === 'hold'"), `[${runtime}] the bridge takes the hold command`);
  const rjs = await (await dev.handle(new Request('http://localhost/__webjs/reload.js'))).text();
  assert.ok(rjs.includes('if (__webjsHold.offer(verdict)) return;'), `[${runtime}] the reload client honours the hold`);

  const prod = await createRequestHandler({ appDir, dev: false });
  const pres = await prod.handle(new Request('http://localhost/'));
  const phtml = await pres.text();
  assert.ok(!phtml.includes('data-webjs-embed'), `[${runtime}] no bridge in production`);
  assert.equal(pres.headers.get('x-frame-options'), 'SAMEORIGIN', `[${runtime}] production keeps X-Frame-Options`);
} finally {
  if (saved === undefined) delete process.env.WEBJS_EMBED_ORIGINS;
  else process.env.WEBJS_EMBED_ORIGINS = saved;
  rmSync(appDir, { recursive: true, force: true });
}

console.log(`[${runtime}] dev-embed: bridge injected with nonce, framing allowed in dev only ✓`);
