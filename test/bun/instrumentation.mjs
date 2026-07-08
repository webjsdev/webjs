/**
 * Cross-runtime proof that the boot-time instrumentation hook (#848) behaves
 * identically on Node and Bun. It dynamically imports the app-root
 * instrumentation.{js,ts} and reads a register()-installed setOnError sink
 * through a module singleton, both runtime-sensitive (module resolution +
 * dynamic import differ between Node's loader and Bun's). Both must agree:
 *
 *   node test/bun/instrumentation.mjs
 *   bun  test/bun/instrumentation.mjs
 *
 * Run from the repo root.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInstrumentation, findInstrumentationClient } from '../../packages/server/src/instrumentation.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const INSTR_SRC = new URL('../../packages/server/src/instrumentation.js', import.meta.url).href;
const dir = mkdtempSync(join(tmpdir(), 'webjs-instr-bun-'));
function w(rel, body) { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); }

try {
  const sentinel = join(dir, 'ran.txt');
  w('instrumentation.js',
    `import { writeFileSync } from 'node:fs';\n` +
    `import { setOnError } from ${JSON.stringify(INSTR_SRC)};\n` +
    `export function register() {\n` +
    `  writeFileSync(${JSON.stringify(sentinel)}, 'ok');\n` +
    `  setOnError((err) => { globalThis.__e = String(err); });\n` +
    `}\n`);
  w('instrumentation-client.js', "console.log('ci');\n");

  const { onError } = await runInstrumentation(dir, { dev: true });
  assert.ok(existsSync(sentinel), 'register() ran');
  assert.equal(typeof onError, 'function', 'the setOnError sink was returned');
  onError(new Error('x'));
  assert.equal(globalThis.__e, 'Error: x');

  const client = await findInstrumentationClient(dir);
  assert.ok(client && client.endsWith('instrumentation-client.js'), 'client hook found at app root');

  console.log(`OK  instrumentation hook behaves identically on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
