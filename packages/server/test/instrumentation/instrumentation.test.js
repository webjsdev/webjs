/**
 * Unit + integration tests for the boot-time instrumentation hook (#848):
 * instrumentation.{js,ts} register() runs once at boot, setOnError composes with
 * the opts.onError sink, and instrumentation-client.{js,ts} is imported FIRST in
 * the client boot script.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runInstrumentation, setOnError } from '../../src/instrumentation.js';
import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();
// The temp app imports setOnError from the SAME module file the test uses, so
// they share the module singleton (Node caches by resolved URL).
const INSTR_SRC = pathToFileURL(resolve(__dirname, '../../src/instrumentation.js')).toString();

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-instr-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

test('runInstrumentation calls register() (default export) exactly once at boot', async () => {
  const sentinel = join(tmpRoot, 'ran.txt');
  const appDir = makeApp({
    'instrumentation.js':
      `import { writeFileSync } from 'node:fs';\n` +
      `export default function register() { writeFileSync(${JSON.stringify(sentinel)}, 'ok'); }\n`,
  });
  const { onError } = await runInstrumentation(appDir, { dev: true });
  assert.ok(existsSync(sentinel), 'register ran');
  assert.equal(onError, null, 'no sink registered -> null');
});

test('a named `register` export works too', async () => {
  const sentinel = join(tmpRoot, 'ran2.txt');
  const appDir = makeApp({
    'instrumentation.js':
      `import { writeFileSync } from 'node:fs';\n` +
      `export function register() { writeFileSync(${JSON.stringify(sentinel)}, 'ok'); }\n`,
  });
  await runInstrumentation(appDir, { dev: true });
  assert.ok(existsSync(sentinel));
});

test('setOnError inside register() is returned as the composed sink', async () => {
  const appDir = makeApp({
    'instrumentation.js':
      `import { setOnError } from ${JSON.stringify(INSTR_SRC)};\n` +
      `export function register() { setOnError((err) => { globalThis.__lastInstrErr = String(err); }); }\n`,
  });
  const { onError } = await runInstrumentation(appDir, { dev: true });
  assert.equal(typeof onError, 'function', 'the register()-installed sink is returned');
  onError(new Error('boom'));
  assert.equal(globalThis.__lastInstrErr, 'Error: boom');
  delete globalThis.__lastInstrErr;
});

test('absent instrumentation file is a no-op', async () => {
  const appDir = makeApp({ 'package.json': '{"name":"x"}' });
  const { onError } = await runInstrumentation(appDir, { dev: true });
  assert.equal(onError, null);
});

test('a throwing register() is fail-open (logged, not fatal)', async () => {
  const appDir = makeApp({
    'instrumentation.js': `export function register() { throw new Error('nope'); }\n`,
  });
  const errs = [];
  const { onError } = await runInstrumentation(appDir, { dev: true, logger: { error: (m) => errs.push(m) } });
  assert.equal(onError, null);
  assert.ok(errs.length >= 1, 'the failure was logged');
});

test('setOnError does not leak across boots (cleared per run)', async () => {
  const appWith = makeApp({
    'instrumentation.js':
      `import { setOnError } from ${JSON.stringify(INSTR_SRC)};\n` +
      `export function register() { setOnError(() => {}); }\n`,
  });
  const appWithout = makeApp({ 'package.json': '{"name":"x"}' });
  const a = await runInstrumentation(appWith, { dev: true });
  assert.equal(typeof a.onError, 'function');
  const b = await runInstrumentation(appWithout, { dev: true });
  assert.equal(b.onError, null, 'the prior boot sink did not leak into this one');
});

test('instrumentation-client.js is imported FIRST in the client boot script', async () => {
  const appDir = makeApp({
    'package.json': '{"name":"x"}',
    'instrumentation-client.js': `console.log('client instrumentation');\n`,
    // A component so the page ships a boot script.
    'components/counter.js':
      `import { WebComponent, html } from ${JSON.stringify(CORE)};\n` +
      `class C extends WebComponent({}) { render() { return html\`<button @click=\${() => {}}>x</button>\`; } }\n` +
      `C.register('my-counter');\n`,
    'app/page.js':
      `import { html } from ${JSON.stringify(CORE)};\n` +
      `import '../components/counter.js';\n` +
      `export default function H() { return html\`<my-counter></my-counter>\`; }\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  await app.warmup?.();
  const resp = await app.handle(new Request('http://x/'));
  const body = await resp.text();
  const boot = body.match(/<script type="module"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(boot, 'a module boot script is present');
  const firstImport = boot[1].trim().split('\n')[0];
  assert.match(firstImport, /instrumentation-client/, 'instrumentation-client is the FIRST import');
});
