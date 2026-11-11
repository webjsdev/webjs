/**
 * `webjs stop` stops the app's running server from the record it wrote, so an
 * agent needs no pkill / kill / pgrep after booting the dev server (54 turns
 * across 24 eval builds). The supervised dev case is the one that matters: the
 * record names the hot-reload supervisor, and stopping only its child would
 * have the supervisor start another, so the counterfactual is the port
 * answering again after the stop. The supervisor writes the record before its
 * `dev.before` steps, so a stop while they run finds it too.
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

function makeApp(webjs = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-stop-'));
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>ok</h1>`;\n");
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'stop-app', type: 'module', imports: { '#*': './*' }, webjs }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));
  return dir;
}

const stop = (dir) => new Promise((done) => {
  // Async, so this process keeps reaping the dev server it spawned meanwhile.
  const c = spawn(process.execPath, [CLI, 'stop'], { cwd: dir, env: { ...process.env, NODE_ENV: 'development' } });
  let stdout = '';
  let stderr = '';
  c.stdout.on('data', (d) => { stdout += d; });
  c.stderr.on('data', (d) => { stderr += d; });
  c.on('close', (status) => done({ status, stdout, stderr }));
});
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('stops a supervised dev server: the supervisor, its child and the port all go', async () => {
  const dir = makeApp();
  const port = 9300 + (process.pid % 200);
  const child = spawn(process.execPath, [CLI, 'dev', '--port', String(port)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development' },
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const exited = new Promise((r) => child.once('exit', r));
  try {
    const up = await until(async () => (await fetch(`http://localhost:${port}/__webjs/version`)).ok, 30_000);
    assert.ok(up, `the dev server never came up\n${log}`);
    const record = JSON.parse(readFileSync(join(dir, '.webjs/dev-server.json'), 'utf8'));
    assert.equal(record.port, port);
    assert.equal(record.pid, child.pid, 'the record names the supervisor, the process to signal');

    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the dev server on port ${port} \\(pid ${child.pid}\\)`));
    await exited;
    assert.equal(alive(record.pid), false, 'the supervisor is gone');
    // Not restarted: a stop that signalled only the child would see the
    // supervisor bring the port back within its crash backoff.
    await sleep(1500);
    await assert.rejects(fetch(`http://localhost:${port}/__webjs/version`), 'the port is free');
    assert.equal(existsSync(join(dir, '.webjs/dev-server.json')), false, 'the record is gone');
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already stopped */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

test('with nothing running it says so and exits 0', async () => {
  const dir = makeApp();
  try {
    const r = await stop(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no server is running for this app/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stale record is removed and nothing is signalled', async () => {
  const dir = makeApp();
  try {
    mkdirSync(join(dir, '.webjs'));
    // A pid that cannot be running: well above any kernel pid_max.
    writeFileSync(join(dir, '.webjs/start-server.json'), JSON.stringify({ port: 8080, pid: 2 ** 30 }));
    const r = await stop(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no start server running \(removed the stale record/);
    assert.equal(existsSync(join(dir, '.webjs/start-server.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A live process whose command line names a path containing "webjs" but is no WebJs server. */
const bystander = () => spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', '/tmp/webjs/server.js', 'start'], { stdio: 'ignore' });

test('a live pid that is not a WebJs server is never signalled, even with "webjs" in its argv', async () => {
  const dir = makeApp();
  const other = bystander();
  try {
    await sleep(100);
    mkdirSync(join(dir, '.webjs'));
    // No start time recorded: the command line decides (where /proc has one).
    writeFileSync(join(dir, '.webjs/dev-server.json'), JSON.stringify({ port: 8080, pid: other.pid }));
    // A start time that is not this process's: the pid was reused.
    writeFileSync(join(dir, '.webjs/start-server.json'), JSON.stringify({ port: 8081, pid: other.pid, startTime: '1' }));
    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    if (existsSync('/proc/self/cmdline')) assert.match(r.stdout, /no dev server running \(removed the stale record/);
    assert.match(r.stdout, /no start server running \(removed the stale record/);
    assert.equal(alive(other.pid), true, 'a reused pid is left alone');
  } finally {
    other.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('run from a subdirectory it acts on the app root', async () => {
  const dir = makeApp();
  try {
    mkdirSync(join(dir, '.webjs'));
    writeFileSync(join(dir, '.webjs/start-server.json'), JSON.stringify({ port: 8080, pid: 2 ** 30 }));
    mkdirSync(join(dir, 'app/blog'), { recursive: true });
    const r = await stop(join(dir, 'app/blog'));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /no start server running \(removed the stale record/);
    assert.equal(existsSync(join(dir, '.webjs/start-server.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('outside any app it says so and exits 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-stop-none-'));
  try {
    const r = await stop(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not inside a WebJs app/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stop while dev.before runs stops the supervisor before the server ever binds', async () => {
  // A before-step that outlasts the test: without the supervisor's early
  // record, the stop found nothing, printed that nothing was running, and the
  // server came up once the step finished.
  const dir = makeApp({ dev: { before: [`"${process.execPath}" -e "setTimeout(() => {}, 20000)"`] } });
  const port = 9500 + (process.pid % 200);
  const child = spawn(process.execPath, [CLI, 'dev', '--port', String(port)], {
    cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development' },
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const exited = new Promise((r) => child.once('exit', r));
  const recordFile = join(dir, '.webjs/dev-server.json');
  try {
    assert.ok(await until(() => /running before-step/.test(log) && existsSync(recordFile), 15_000), `the before-step never started\n${log}`);
    const record = JSON.parse(readFileSync(recordFile, 'utf8'));
    assert.equal(record.pid, child.pid);
    assert.equal(record.port, port);
    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the dev server on port ${port} \\(pid ${child.pid}\\)`));
    await exited;
    assert.equal(existsSync(recordFile), false, 'the record is gone');
    await assert.rejects(fetch(`http://localhost:${port}/__webjs/version`), 'nothing ever bound the port');
  } finally {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already stopped */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a second server on the same port fails and leaves the first one\'s record; stop stops the first', async () => {
  const dir = makeApp();
  const port = 9700 + (process.pid % 200);
  const env = { ...process.env, NODE_ENV: 'production' };
  const first = spawn(process.execPath, [CLI, 'start', '--port', String(port)], { cwd: dir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env });
  let log = '';
  first.stdout.on('data', (d) => { log += d; });
  first.stderr.on('data', (d) => { log += d; });
  const exited = new Promise((r) => first.once('exit', r));
  const recordFile = join(dir, '.webjs/start-server.json');
  try {
    assert.ok(await until(() => existsSync(recordFile), 30_000), `the first server never recorded itself\n${log}`);
    const before = readFileSync(recordFile, 'utf8');
    assert.equal(JSON.parse(before).pid, first.pid);
    const second = await new Promise((done) => {
      const c = spawn(process.execPath, [CLI, 'start', '--port', String(port)], { cwd: dir, env });
      let err = '';
      c.stderr.on('data', (d) => { err += d; });
      c.on('close', (status) => done({ status, err }));
    });
    assert.equal(second.status, 98, `the second server fails on the taken port\n${second.err}`);
    assert.equal(readFileSync(recordFile, 'utf8'), before, 'the first server\'s record is untouched');
    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the start server on port ${port} \\(pid ${first.pid}\\)`));
    await exited;
  } finally {
    try { process.kill(-first.pid, 'SIGKILL'); } catch { /* already stopped */ }
    rmSync(dir, { recursive: true, force: true });
  }
});
