/**
 * CLI integration tests for `webjs vendor pin` / `unpin` / `list`.
 *
 * Spawns the actual webjs CLI binary against a temp app directory and
 * asserts the file-system + stdout contracts.
 *
 * Network-gated: pin without --download calls api.jspm.io. Skip via
 * WEBJS_SKIP_NETWORK_TESTS=1 in air-gapped CI environments.
 */
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const CLI = resolve(REPO_ROOT, 'packages', 'cli', 'bin', 'webjs.js');

const NETWORK_OK = !process.env.WEBJS_SKIP_NETWORK_TESTS;

function runCli(args, cwd) {
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('exit', (code) => res({ code, stdout, stderr }));
    child.on('error', rej);
  });
}

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-vendor-cli-'));
  await symlink(join(REPO_ROOT, 'node_modules'), join(dir, 'node_modules'));
  await writeFile(join(dir, 'package.json'), '{"name":"tmp","version":"0.0.0"}');
  await mkdir(join(dir, 'app'), { recursive: true });
  await writeFile(join(dir, 'app', 'page.ts'), `import pico from 'picocolors';\nexport default () => pico.green('ok');`);
  return dir;
}

describe('webjs vendor CLI', () => {
  let appDir;

  before(async () => {
    appDir = await makeApp();
  });

  after(async () => {
    await rm(appDir, { recursive: true, force: true });
  });

  test('list with no pin file reports "No pin file"', async () => {
    const { code, stdout } = await runCli(['vendor', 'list'], appDir);
    assert.equal(code, 0);
    assert.match(stdout, /No pin file/);
  });

  test('pin writes .webjs/vendor/importmap.json with picocolors entry', { skip: !NETWORK_OK }, async () => {
    const { code, stdout, stderr } = await runCli(['vendor', 'pin'], appDir);
    assert.equal(code, 0, `pin failed: ${stderr}`);
    assert.match(stdout, /Pinning vendor packages/);
    assert.match(stdout, /picocolors@/);
    assert.match(stdout, /wrote \.webjs\/vendor\/importmap\.json/);

    const file = await readFile(join(appDir, '.webjs', 'vendor', 'importmap.json'), 'utf8');
    const parsed = JSON.parse(file);
    assert.ok(parsed.imports.picocolors, 'picocolors should be in the pinned importmap');
    assert.match(parsed.imports.picocolors, /^https:\/\/ga\.jspm\.io\/npm:picocolors@/);
  });

  test('list with pin file reports the pinned package + URL', { skip: !NETWORK_OK }, async () => {
    const { code, stdout } = await runCli(['vendor', 'list'], appDir);
    assert.equal(code, 0);
    assert.match(stdout, /picocolors@/);
    assert.match(stdout, /https:\/\/ga\.jspm\.io\/npm:picocolors@/);
  });

  test('unpin removes a package entry from importmap.json', { skip: !NETWORK_OK }, async () => {
    const { code, stdout } = await runCli(['vendor', 'unpin', 'picocolors'], appDir);
    assert.equal(code, 0);
    assert.match(stdout, /picocolors\s+unpinned/);

    // If unpinning the LAST entry, the file is removed entirely so
    // the next boot falls back to live API resolution (otherwise an
    // empty `{ imports: {} }` would shadow that fallback). If the
    // test scaffold had multiple pinned packages we'd assert the
    // file persists with the other entries; here it had just
    // picocolors, so the file is gone.
    const { existsSync } = await import('node:fs');
    assert.equal(existsSync(join(appDir, '.webjs', 'vendor', 'importmap.json')), false,
      'pin file removed when last pin unpinned');
  });

  test('unpin a non-existent package reports "not in pin file"', async () => {
    const { code, stderr } = await runCli(['vendor', 'unpin', 'not-pinned-xyz'], appDir);
    assert.equal(code, 0);
    assert.match(stderr, /not in pin file/);
  });

  test('pin --download writes bundle files alongside importmap.json', { skip: !NETWORK_OK }, async () => {
    const { code, stdout, stderr } = await runCli(['vendor', 'pin', '--download'], appDir);
    assert.equal(code, 0, `pin --download failed: ${stderr}`);
    assert.match(stdout, /downloading bundles/);
    assert.match(stdout, /picocolors@.*\d+\.\d+ KB/);
    assert.match(stdout, /wrote \.webjs\/vendor\/importmap\.json \+ \d+ bundle/);

    const file = await readFile(join(appDir, '.webjs', 'vendor', 'importmap.json'), 'utf8');
    const parsed = JSON.parse(file);
    assert.match(parsed.imports.picocolors, /^\/__webjs\/vendor\/picocolors@.*\.js$/);

    const bundleName = parsed.imports.picocolors.slice('/__webjs/vendor/'.length);
    const bundleBytes = await readFile(join(appDir, '.webjs', 'vendor', bundleName), 'utf8');
    assert.ok(bundleBytes.length > 0, 'bundle file should have bytes');
  });

  test('unknown vendor subcommand exits with usage message', async () => {
    const { code, stderr } = await runCli(['vendor', 'invalid'], appDir);
    assert.equal(code, 1);
    assert.match(stderr, /Unknown vendor subcommand/);
    assert.match(stderr, /webjs vendor pin/);
  });
});
