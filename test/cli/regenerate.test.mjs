/**
 * `webjs regenerate` (#1672): the CLI front door to the regenerate build record,
 * the one way a build outside the dev server (dev.before, start.before, a CI
 * step) records freshness. The engine is unit-tested in
 * packages/server/test/dev/dev-regenerate.test.js; this proves the command
 * builds what is not fresh, skips what is, honours `--force` and `--json`, and
 * exits 1 when a rule fails or does not write its output.
 *
 * Every rule command is a portable POSIX shell line that appends to ran.log, so
 * the log counts the runs and no compiler is needed.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', '..', 'packages', 'cli', 'bin', 'webjs.js');
const dirs = [];
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function app(rules) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-regen-cli-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'public'), { recursive: true });
  writeFileSync(join(dir, 'app', 'page.ts'), 'export default () => 1;');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', webjs: { dev: { regenerate: rules } } }));
  return dir;
}
const run = (dir, ...args) => spawnSync(process.execPath, [CLI, 'regenerate', ...args], { cwd: dir, encoding: 'utf8' });
const runs = (dir) => (existsSync(join(dir, 'ran.log')) ? readFileSync(join(dir, 'ran.log'), 'utf8').length : 0);
const rule = (out, extra = '') => ({ output: out, command: `printf x >> ran.log; printf '.a{}' > ${out}${extra}`, inputs: ['app'] });

test('builds what is not fresh, records it, then skips it; --force rebuilds', () => {
  const dir = app([rule('public/a.css'), rule('public/b.css')]);
  let r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /public\/a\.css built \(was missing\)/);
  assert.equal(runs(dir), 2);
  assert.ok(existsSync(join(dir, '.webjs', 'regenerate.json')), 'the builds are recorded');

  r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /public\/a\.css fresh/);
  assert.equal(runs(dir), 2, 'a recorded, unchanged output is not rebuilt');

  writeFileSync(join(dir, 'app', 'page.ts'), 'export default () => 2;');
  run(dir);
  assert.equal(runs(dir), 4, 'an input edit rebuilds both');

  run(dir, '--force');
  assert.equal(runs(dir), 6, '--force rebuilds fresh outputs too');
});

test('--json emits one result per rule', () => {
  const dir = app([rule('public/a.css')]);
  const r = run(dir, '--json');
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), [{ output: 'public/a.css', state: 'missing', built: true, ok: true }]);
});

test('exits 1 when a rule fails, and when a rule exits 0 without writing its output', () => {
  const failing = app([rule('public/a.css', '; exit 4')]);
  const f = run(failing);
  assert.equal(f.status, 1);
  assert.match(f.stdout, /public\/a\.css FAILED/);

  const misnamed = app([{ output: 'public/a.css', command: "printf '.a{}' > public/other.css", inputs: ['app'] }]);
  const m = run(misnamed);
  assert.equal(m.status, 1, 'a rule whose output is not what its command writes is a failure');
  assert.match(m.stdout, /exited 0 without writing it/);
  assert.match(m.stderr, /did not write public\/a\.css/);
});

test('an app with no rules says so and exits 0', () => {
  const dir = app(undefined);
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /no "webjs\.dev\.regenerate" rules/);
});
