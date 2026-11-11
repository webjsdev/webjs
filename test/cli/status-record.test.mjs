/**
 * The dev record follows the port the server actually bound, and `webjs status`
 * reads it from anywhere inside the app.
 *
 * The supervisor writes `.webjs/dev-server.json` before its child exists, with
 * the port argv and env name. That guess is wrong for `--port 0` and after a
 * `.env` PORT edit restarts the child on another port, so each child reports
 * its bound port over IPC and the supervisor rewrites the record. Without the
 * report the record keeps 0 (or the old port) and these tests time out on it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = join(ROOT, 'packages/cli/bin/webjs.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { if (await fn()) return true; } catch { /* keep polling */ }
    if (Date.now() > deadline) return false;
    await sleep(150);
  }
}

function makeApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-status-record-'));
  mkdirSync(join(dir, 'app/blog'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>ok</h1>`;\n");
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'status-record-app', type: 'module', imports: { '#*': './*' }, webjs: {} }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));
  return dir;
}

/** The environment a CLI child runs in, with no PORT leaking from this shell. */
function cliEnv(extra = {}) {
  const env = { ...process.env, NODE_ENV: 'development', ...extra };
  delete env.PORT;
  return env;
}

const runCli = (args, cwd) => new Promise((done) => {
  // Async, so this process keeps reaping the dev server it spawned meanwhile.
  const c = spawn(process.execPath, [CLI, ...args], { cwd, env: cliEnv() });
  let stdout = '';
  let stderr = '';
  c.stdout.on('data', (d) => { stdout += d; });
  c.stderr.on('data', (d) => { stderr += d; });
  c.on('close', (status) => done({ status, stdout, stderr }));
});

function startDev(dir, args) {
  const child = spawn(process.execPath, [CLI, 'dev', ...args], { cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: cliEnv() });
  const out = { log: '' };
  child.stdout.on('data', (d) => { out.log += d; });
  child.stderr.on('data', (d) => { out.log += d; });
  return { child, out, exited: new Promise((r) => child.once('exit', r)) };
}

const readRecord = (dir) => JSON.parse(readFileSync(join(dir, '.webjs/dev-server.json'), 'utf8'));
const answers = async (port) => (await fetch(`http://localhost:${port}/__webjs/version`)).ok;

test('dev --port 0: the record ends up with the port the child bound, and status run from a subdirectory probes it', async () => {
  const dir = makeApp();
  const { child, out, exited } = startDev(dir, ['--port', '0']);
  try {
    const bound = await until(() => existsSync(join(dir, '.webjs/dev-server.json')) && readRecord(dir).port > 0, 30_000);
    assert.ok(bound, `the record never carried the bound port\n${out.log}`);
    const record = readRecord(dir);
    assert.equal(record.pid, child.pid, 'still the supervisor\'s record');
    assert.ok(await until(() => answers(record.port), 10_000), `nothing answers on the recorded port ${record.port}`);

    const r = await runCli(['status', '/'], join(dir, 'app/blog'));
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    assert.doesNotMatch(r.stderr, /booting the app in-process/, 'it found the running server instead of booting one');

    process.kill(child.pid, 'SIGTERM');
    await exited;
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already stopped */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a .env PORT edit restarts the child on the new port, and the record follows it', async () => {
  const dir = makeApp();
  const base = 9900 + (process.pid % 40) * 2;
  writeFileSync(join(dir, '.env'), `PORT=${base}\n`);
  const { child, out, exited } = startDev(dir, []);
  try {
    assert.ok(await until(() => answers(base), 30_000), `the first child never came up on ${base}\n${out.log}`);
    assert.equal(readRecord(dir).port, base);

    writeFileSync(join(dir, '.env'), `PORT=${base + 1}\n`);
    const moved = await until(async () => readRecord(dir).port === base + 1 && await answers(base + 1), 30_000);
    assert.ok(moved, `the record did not follow the restarted child (record ${JSON.stringify(readRecord(dir))})\n${out.log}`);
    assert.equal(readRecord(dir).pid, child.pid);

    process.kill(child.pid, 'SIGTERM');
    await exited;
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already stopped */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

test('status outside any app refuses with exit 1, in human and JSON form', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-status-none-'));
  try {
    const r = await runCli(['status'], dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not inside a WebJs app/);
    const j = await runCli(['status', '--json'], dir);
    assert.equal(j.status, 1);
    assert.equal(JSON.parse(j.stdout).error.code, 'NOT_AN_APP');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
