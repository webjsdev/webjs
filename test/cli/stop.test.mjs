/**
 * `webjs stop` stops the app's running server from the record it wrote, so an
 * agent needs no pkill / kill / pgrep after booting the dev server (54 turns
 * across 24 eval builds). The supervised dev case is the one that matters: the
 * record names the server child, and stopping only the child would have the
 * hot-reload supervisor start another, so the counterfactual is the port
 * answering again after the stop.
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
  const dir = mkdtempSync(join(tmpdir(), 'webjs-stop-'));
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'app/page.ts'), "import { html } from '@webjsdev/core';\nexport default () => html`<h1>ok</h1>`;\n");
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'stop-app', type: 'module', imports: { '#*': './*' }, webjs: {} }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  symlinkSync(join(ROOT, 'packages/core'), join(dir, 'node_modules/@webjsdev/core'));
  symlinkSync(join(ROOT, 'packages/server'), join(dir, 'node_modules/@webjsdev/server'));
  return dir;
}

const stop = (dir) => new Promise((done) => {
  // Async, so this process keeps reaping the dev server it spawned meanwhile.
  const c = spawn(process.execPath, [CLI, 'stop'], { cwd: dir });
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
    assert.equal(record.stopPid, child.pid, 'the record names the supervisor to signal');
    assert.notEqual(record.pid, child.pid, 'beside the server child it supervises');

    const r = await stop(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, new RegExp(`stopped the dev server on port ${port} \\(pid ${child.pid}\\)`));
    await exited;
    assert.equal(alive(record.pid), false, 'the server child is gone');
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

test('a live pid that is not a WebJs process is never signalled', { skip: !existsSync('/proc/self/cmdline') }, async () => {
  const dir = makeApp();
  const bystander = spawn('sleep', ['30']);
  try {
    mkdirSync(join(dir, '.webjs'));
    writeFileSync(join(dir, '.webjs/dev-server.json'), JSON.stringify({ port: 8080, pid: bystander.pid }));
    const r = await stop(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /stale record/);
    assert.equal(alive(bystander.pid), true, 'a reused pid is left alone');
  } finally {
    bystander.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});
