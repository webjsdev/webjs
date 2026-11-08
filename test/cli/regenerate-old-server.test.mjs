/**
 * `webjs regenerate` (#1672) against a @webjsdev/server older than the CLI. A
 * published CLI can meet a server that predates `regenerateOutputs`, and the
 * command must name that cause and exit 1 rather than crash with a TypeError.
 *
 * Node-only: the older server is stood in by a `node:module` `registerHooks`
 * resolve hook loaded through `--import`, which Bun does not implement, so this
 * file is on the Bun matrix denylist (scripts/run-bun-tests.js). The behaviour
 * it checks is CLI-side and runtime-agnostic; the rest of the command's tests
 * stay in regenerate.test.mjs and run on both runtimes.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '..', '..', 'packages', 'cli', 'bin', 'webjs.js');
const dirs = [];
after(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

test('against a @webjsdev/server that predates the command it names the cause and exits 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-regen-cli-old-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'app', 'page.ts'), 'export default () => 1;');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'x',
    webjs: { dev: { regenerate: [{ output: 'public/a.css', command: "printf '.a{}' > public/a.css", inputs: ['app'] }] } },
  }));

  // Resolve @webjsdev/server to a build that has everything the CLI needs to
  // start but no regenerateOutputs, the shape of a server older than the CLI.
  const nodeVersion = pathToFileURL(resolve(__dirname, '..', '..', 'packages', 'server', 'src', 'node-version.js')).href;
  const oldServer = 'data:text/javascript,' + encodeURIComponent(`export { assertNodeVersion } from ${JSON.stringify(nodeVersion)};`);
  const hook = 'data:text/javascript,' + encodeURIComponent(
    `import { registerHooks } from 'node:module';
     registerHooks({ resolve(s, c, n) { return s === '@webjsdev/server' ? { url: ${JSON.stringify(oldServer)}, shortCircuit: true } : n(s, c); } });`,
  );
  const r = spawnSync(process.execPath, ['--import', hook, CLI, 'regenerate'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /predates the regenerate build record/);
  assert.doesNotMatch(r.stderr, /TypeError/);
});
