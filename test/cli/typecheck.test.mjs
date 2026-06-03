/**
 * Tests for `webjs typecheck` (#265): a thin wrapper that runs the project's
 * own `tsc --noEmit`, exits non-zero on type errors, and degrades gracefully
 * with a clear message when TypeScript is not installed.
 *
 * The success / type-error fixtures live UNDER the repo so node resolves the
 * repo's `typescript` (the CLI resolves tsc relative to the app cwd). The
 * graceful-degradation fixture lives in the OS tmpdir, OUTSIDE the repo's
 * node_modules tree, so `typescript` is genuinely unresolvable.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const CLI = resolve(REPO, 'packages', 'cli', 'bin', 'webjs.js');

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    noEmit: true,
    strict: true,
    erasableSyntaxOnly: true,
    module: 'nodenext',
    moduleResolution: 'nodenext',
    skipLibCheck: true,
  },
  include: ['*.ts'],
});

const cleanup = [];
after(() => { for (const d of cleanup) rmSync(d, { recursive: true, force: true }); });

/** Make a fixture app dir with a tsconfig and one source file. */
function makeFixture(baseDir, source) {
  const dir = mkdtempSync(join(baseDir, 'tc-'));
  cleanup.push(dir);
  writeFileSync(join(dir, 'package.json'), '{}');
  writeFileSync(join(dir, 'tsconfig.json'), TSCONFIG);
  writeFileSync(join(dir, 'app.ts'), source);
  return dir;
}

function typecheck(cwd) {
  return spawnSync(process.execPath, [CLI, 'typecheck'], { cwd, encoding: 'utf8' });
}

test('webjs typecheck exits 0 on a clean TypeScript app', () => {
  const dir = makeFixture(REPO, 'export const n: number = 42;\n');
  const r = typecheck(dir);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stdout}\n${r.stderr}`);
});

test('webjs typecheck exits non-zero and reports the error on a type error', () => {
  const dir = makeFixture(REPO, 'const n: number = "not a number";\n');
  const r = typecheck(dir);
  assert.notEqual(r.status, 0, 'a type error must produce a non-zero exit');
  assert.match(r.stdout + r.stderr, /TS2322|not assignable/, 'reports the tsc error');
});

test('webjs typecheck degrades gracefully when TypeScript is not installed', () => {
  // OS tmpdir is outside the repo node_modules tree, so typescript is unresolvable.
  const dir = makeFixture(tmpdir(), 'export const n = 1;\n');
  const r = typecheck(dir);
  assert.notEqual(r.status, 0, 'exits non-zero when typescript is missing');
  assert.match(r.stderr, /TypeScript is not installed/, 'prints a clear message');
  assert.match(r.stderr, /npm install -D typescript/, 'tells the user how to fix it');
});
