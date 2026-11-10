/**
 * Cross-runtime proof for server-only components (#1686): a `WebComponent` in
 * a `*.server.ts` file renders on the server (an `async render()` included)
 * and ships nothing, the way a Next.js server component does. Run from the
 * repo root under either runtime:
 *
 *   node test/bun/server-component.mjs
 *   bun  test/bun/server-component.mjs
 *
 * Asserts: the page renders the component's markup into its tag; the boot
 * script imports nothing (no other component on the page); the component's
 * source is not served; and a client component wrapping it gets it as a
 * server-rendered child in its slot while the client component itself boots.
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRequestHandler } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const here = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(here, '../../packages/core/index.js')).toString());
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'webjs-server-component-'));
const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
try {
  w('package.json', JSON.stringify({ name: 'server-component', type: 'module' }));
  w('lib/users.server.ts', 'export async function getUser(id: string) { return { name: id === "1" ? "Ada" : "Grace" }; }\n');
  w('components/user-card.server.ts',
    `import { WebComponent, html } from ${CORE};\nimport { getUser } from '../lib/users.server.ts';\n` +
    'export class UserCard extends WebComponent({ uid: String }) {\n' +
    '  async render() { const u = await getUser(this.uid); return html`<div class="card"><b>${u.name}</b></div>`; }\n}\n' +
    "UserCard.register('user-card');\n");
  w('components/x-tabs.ts',
    `import { WebComponent, html } from ${CORE};\n` +
    'export class Tabs extends WebComponent({ active: Number }) {\n' +
    '  render() { return html`<button @click=${() => { this.active++; }}>${this.active}</button><slot></slot>`; }\n}\n' +
    "Tabs.register('x-tabs');\n");
  w('app/page.ts',
    `import { html } from ${CORE};\nimport '../components/user-card.server.ts';\n` +
    'export default () => html`<main><user-card uid="1"></user-card></main>`;\n');
  w('app/tabs/page.ts',
    `import { html } from ${CORE};\nimport '../../components/user-card.server.ts';\nimport '../../components/x-tabs.ts';\n` +
    'export default () => html`<x-tabs><user-card uid="2"></user-card></x-tabs>`;\n');

  const app = await createRequestHandler({ appDir: dir, dev: false, logger: quiet });
  await app.warmup();
  const boot = (html) => [...(((html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/) || [])[1]) || '')
    .matchAll(/import\s+"([^"]+)"/g)].map((m) => m[1].split('?')[0]);

  const res = await app.handle(new Request('http://localhost/'));
  assert.equal(res.status, 200, `the page renders on ${runtime}`);
  const body = await res.text();
  assert.match(body, /<user-card[^>]*>[\s\S]*<b>Ada<\/b>[\s\S]*<\/user-card>/, `the server component's async render is in the HTML on ${runtime}`);
  assert.deepEqual(boot(body), [], `nothing boots for a page with only a server component on ${runtime}`);
  assert.equal((await app.handle(new Request('http://localhost/components/user-card.server.ts'))).status, 404,
    `the server component's source is not served on ${runtime}`);

  const tabs = await (await app.handle(new Request('http://localhost/tabs'))).text();
  assert.match(tabs, /<x-tabs[^>]*>[\s\S]*<user-card[^>]*>[\s\S]*<b>Grace<\/b>/, `the server component renders inside the client one on ${runtime}`);
  assert.deepEqual(boot(tabs), ['/components/x-tabs.ts'], `only the client component boots on ${runtime}`);
  console.log(`[server-component] OK on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
