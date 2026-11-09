/**
 * Cross-runtime proof that route modules never ship (#1686). WebJs runs on
 * Node 24+ OR Bun, and the boot assembly sits on the SSR path of both. Run
 * from the repo root:
 *
 *   node test/bun/route-modules-server-only.mjs
 *   bun  test/bun/route-modules-server-only.mjs
 *
 * Asserts, under whichever runtime runs it: a page
 * that does module-scope work an older lexical guess read as client work (an
 * `Intl` formatter, an `Array.from`, a call to a class-name helper), imports
 * a no-directive `.server.ts` utility, and renders an interactive component,
 * renders 200; its boot script and modulepreload hints name the component and
 * never the page or its layout; and the layout's `client-router` import does
 * not pull the layout into the boot either.
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createRequestHandler } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const here = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(here, '../../packages/core/index.js')).toString();
const ROUTER = pathToFileURL(resolve(here, '../../packages/core/src/router-client.js')).toString();
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'webjs-route-server-only-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
try {
  w('package.json', JSON.stringify({ name: 'route-server-only', type: 'module' }));
  w('lib/db.server.ts', 'export function listEvents() { return [1, 2, 3]; }\n');
  w('lib/cn.ts', 'export const cn = (...c: string[]) => c.filter(Boolean).join(" ");\n');
  w('components/x-counter.ts',
    `import { WebComponent, html } from ${JSON.stringify(CORE)};\n` +
    'class XCounter extends WebComponent({ n: Number }) {\n' +
    '  constructor() { super(); this.n = 0; }\n' +
    '  render() { return html`<button @click=${() => { this.n++; }}>${this.n}</button>`; }\n' +
    '}\nXCounter.register(\'x-counter\');\n');
  w('app/layout.ts',
    `import { html } from ${JSON.stringify(CORE)};\n` +
    `import ${JSON.stringify(ROUTER)};\n` +
    'export default ({ children }: { children: unknown }) => html`<main>${children}</main>`;\n');
  w('app/page.ts',
    `import { html } from ${JSON.stringify(CORE)};\n` +
    "import { listEvents } from '../lib/db.server.ts';\n" +
    "import { cn } from '../lib/cn.ts';\n" +
    "import '../components/x-counter.ts';\n" +
    "const fmt = new Intl.NumberFormat('en');\n" +
    'const HOURS = Array.from({ length: 3 }, (_, h) => h);\n' +
    "const cls = cn('a', 'b');\n" +
    'export default () => html`<p class=${cls}>${fmt.format(listEvents().length)} ${HOURS.length}</p><x-counter></x-counter>`;\n');

  {
    const app = await createRequestHandler({ appDir: dir, dev: false, logger: quiet });
    await app.warmup();
    const res = await app.handle(new Request('http://localhost/'));
    assert.equal(res.status, 200, `the page renders on ${runtime}`);
    const html = await res.text();
    const boot = (html.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/) || [])[1] || '';
    const imports = [...boot.matchAll(/import\s+"([^"]+)"/g)].map((m) => m[1].split('?')[0]);
    const preloads = [...html.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1].split('?')[0]);
    assert.ok(imports.includes('/components/x-counter.ts'), `the component boots on ${runtime}: ${imports}`);
    for (const f of ['/app/page.ts', '/app/layout.ts', '/lib/db.server.ts', '/lib/cn.ts']) {
      assert.ok(!imports.includes(f), `${f} is not booted on ${runtime}`);
      assert.ok(!preloads.includes(f), `${f} is not preloaded on ${runtime}`);
    }
  }
  console.log(`[route-modules-server-only] OK on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
