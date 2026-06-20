/**
 * Cross-runtime smoke test (#508): boot a minimal webjs app through
 * `createRequestHandler` and assert SSR HTML plus TypeScript-stripped `.ts`
 * serving, under WHICHEVER runtime executes this file. Run it under both:
 *
 *   node test/bun/smoke.mjs
 *   bun  test/bun/smoke.mjs
 *
 * On Node the stripper is the built-in `module.stripTypeScriptTypes`; on Bun
 * (which lacks it) the `amaro` fallback resolves transparently. A plain assert
 * script (not node:test) so the SAME file runs identically on both runtimes; it
 * exits non-zero on failure. Run it from the repo root so the bare
 * `@webjsdev/server` specifier resolves to the workspace package.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequestHandler, hashFile } from '@webjsdev/server';
import { stringify, parse } from '@webjsdev/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Absolute file URL to @webjsdev/core, injected into the fixture so its SSR
// imports resolve regardless of the temp-dir location (the same trick the Node
// integration tests use).
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

const dir = mkdtempSync(join(tmpdir(), 'webjs-runtime-smoke-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'smoke', type: 'module', webjs: {} }));
  w('app/layout.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ children }: { children: unknown }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nimport '../components/hi-there.ts';\nexport default function Page() { return html\`<main><hi-there></hi-there></main>\`; }\n`);
  w('components/hi-there.ts', `import { WebComponent, html } from ${JSON.stringify(CORE)};\nexport class HiThere extends WebComponent {\n  greet(name: string): string { return 'hi ' + name; }\n  render() { const n: number = 42; return html\`<p class="hi">\${this.greet('there')} \${n}</p>\`; }\n}\nHiThere.register('hi-there');\n`);
  // A server action, to round-trip the RPC wire (serializer + dispatch) on the runtime.
  const actionFile = join(dir, 'actions/echo.server.ts');
  w('actions/echo.server.ts', `'use server';\nexport async function echo(input: { n: number; at: Date }) { return { doubled: input.n * 2, at: input.at }; }\n`);

  const app = await createRequestHandler({ appDir: dir, dev: true });
  if (app.warmup) await app.warmup();

  // 1. SSR renders the component's resolved output (no JS needed).
  const page = await app.handle(new Request('http://localhost/'));
  assert.equal(page.status, 200, 'GET / should be 200');
  const pageHtml = await page.text();
  assert.ok(pageHtml.includes('hi there 42'), `SSR HTML should contain the rendered text; got:\n${pageHtml.slice(0, 400)}`);

  // 2. The `.ts` component is served as JavaScript with its types stripped.
  const comp = await app.handle(new Request('http://localhost/components/hi-there.ts'));
  assert.equal(comp.status, 200, 'GET the .ts component should be 200');
  const js = await comp.text();
  assert.ok(!/:\s*string/.test(js) && !/:\s*number/.test(js), `served component should have its type annotations stripped; got:\n${js}`);
  assert.ok(js.includes('class HiThere') && js.includes("register('hi-there')"), 'stripped output should still be valid JS (class + register intact)');
  // Position-preserving strip: the method/render lines keep their line numbers
  // (the source has 6 code lines; assert the class body line structure survives
  // rather than an exact count, which dev-time transforms may pad).
  assert.ok(js.includes('\nexport class HiThere'), 'the class declaration stays on its own line (strip preserved newlines)');

  // 3. A server action round-trips over RPC (the serializer + dispatch), with a
  // rich Date value, proving the action path works on this runtime.
  const hash = await hashFile(actionFile);
  const when = new Date('2021-02-03T04:05:06.000Z');
  // Action CSRF is an Origin / Sec-Fetch-Site check (#659): same-origin passes.
  const rpc = await app.handle(new Request(`http://localhost/__webjs/action/${hash}/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/vnd.webjs+json', 'sec-fetch-site': 'same-origin' },
    body: await stringify([{ n: 21, at: when }]),
  }));
  assert.equal(rpc.status, 200, 'the action RPC should be 200');
  const result = parse(await rpc.text());
  assert.equal(result.doubled, 42, 'the action ran server-side and returned the computed value');
  assert.ok(result.at instanceof Date && result.at.getTime() === when.getTime(), 'a rich Date round-trips through the RPC serializer on this runtime');

  console.log(`OK  webjs runtime smoke passed on ${runtime} (SSR + TS strip + server-action RPC)`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
