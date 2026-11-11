/**
 * `webjs dev` records the port it serves on and `webjs status` reads it back
 * (#1686). An eval agent started the dev server with `--port 8910`, then ran
 * `webjs status`, which looked at the 8080 default, found nothing, and booted a
 * second in-process copy instead of reporting on the server that was up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync, readFileSync, chmodSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { recordDevPort, recordedDevPort } from '../../packages/cli/lib/port.js';
import { isLiveServer, processStartTime, updateRecordedPort, boundPort, claimServerRecord } from '../../packages/cli/lib/server-record.js';

const PORT_JS = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../../packages/cli/lib/port.js')).href;

test('a recorded port is read back while its process lives', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-port-'));
  try {
    assert.equal(recordedDevPort(dir), null, 'nothing recorded');
    recordDevPort(dir, 8910);
    assert.equal(recordedDevPort(dir), 8910);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a record left by a process that is gone is ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-port-'));
  try {
    mkdirSync(join(dir, '.webjs'));
    // A pid that cannot be running: well above any kernel pid_max.
    writeFileSync(join(dir, '.webjs', 'dev-server.json'), JSON.stringify({ port: 8910, pid: 2 ** 30 }));
    assert.equal(recordedDevPort(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a dev server removes its own record when it exits', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-port-'));
  try {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const { recordDevPort } = await import(${JSON.stringify(PORT_JS)}); recordDevPort(${JSON.stringify(dir)}, 8920);`]);
    assert.equal(r.status, 0, String(r.stderr));
    assert.equal(existsSync(join(dir, '.webjs', 'dev-server.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a record whose pid now belongs to another process is ignored, as `webjs stop` ignores it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-port-'));
  // Alive, with a path holding the brand name in its argv, but no WebJs server.
  const other = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)', '/tmp/webjs/server.js', 'dev'], { stdio: 'ignore' });
  try {
    await new Promise((r) => setTimeout(r, 100));
    mkdirSync(join(dir, '.webjs'));
    const file = join(dir, '.webjs', 'dev-server.json');
    // A start time that is not the process's: the pid was reused.
    writeFileSync(file, JSON.stringify({ port: 8910, pid: other.pid, startTime: '1' }));
    assert.equal(recordedDevPort(dir), null, 'a mismatched start time');
    assert.equal(isLiveServer({ pid: other.pid, startTime: '1' }), false);
    if (existsSync('/proc/self/cmdline')) {
      // No start time (an older record): the command line decides.
      writeFileSync(file, JSON.stringify({ port: 8910, pid: other.pid }));
      assert.equal(recordedDevPort(dir), null, 'a command line that runs no CLI server');
    }
    // The real start time of a live process is accepted.
    const startTime = processStartTime(other.pid);
    if (startTime) {
      writeFileSync(file, JSON.stringify({ port: 8910, pid: other.pid, startTime }));
      assert.equal(recordedDevPort(dir), 8910);
    }
  } finally {
    other.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a live server record is never overwritten, nor removed by a process that did not write it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-port-'));
  try {
    // This test process plays the running server.
    recordDevPort(dir, 8910);
    const file = join(dir, '.webjs', 'dev-server.json');
    const before = readFileSync(file, 'utf8');
    // A second server records itself on its way to failing to bind, then exits.
    const r = spawnSync(process.execPath, ['--input-type=module', '-e',
      `const { recordDevPort } = await import(${JSON.stringify(PORT_JS)}); const rec = recordDevPort(${JSON.stringify(dir)}, 8911); if (rec.pid === process.pid) process.exit(3);`]);
    assert.equal(r.status, 0, `the second process kept the live record (${String(r.stderr)})`);
    assert.equal(readFileSync(file, 'utf8'), before, 'the record still names the first server');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('updateRecordedPort moves only this process\'s record to the bound port, keeping pid and start time', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-port-'));
  try {
    // A supervisor started with --port 0 records 0, which status never probes.
    recordDevPort(dir, 0);
    assert.equal(recordedDevPort(dir), null, 'port 0 is not a port to probe');
    const file = join(dir, '.webjs', 'dev-server.json');
    const { pid, startTime } = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(updateRecordedPort(dir, 'dev', 43210), true);
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { port: 43210, pid, ...(startTime ? { startTime } : {}) });
    assert.equal(recordedDevPort(dir), 43210);
    // Another process's record is not ours to move.
    writeFileSync(file, JSON.stringify({ port: 8910, pid: 2 ** 30 }));
    assert.equal(updateRecordedPort(dir, 'dev', 43211), false);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).port, 8910);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('boundPort reads a node:http or Bun.serve handle, else falls back', () => {
  assert.equal(boundPort({ server: { address: () => ({ port: 5123 }) } }, 0), 5123);
  assert.equal(boundPort({ server: { port: 5124 } }, 0), 5124);
  assert.equal(boundPort(undefined, 8080), 8080);
  assert.equal(boundPort({ server: { address: () => null } }, 8080), 8080);
});

test('a process start time reads the same whatever TZ the reader runs in, on the ps path and the /proc path', (t) => {
  // The dev supervisor records after loading the app's `.env` (which may set
  // TZ); `webjs stop` never loads it. `ps -o lstart=` prints local time, so
  // without a pinned zone the two sides read different strings for one live
  // server, and stop called it stale and deleted its record.
  const saved = process.env.TZ;
  const read = (tz, opts) => {
    process.env.TZ = tz;
    return processStartTime(process.pid, opts);
  };
  try {
    const viaPs = [read('UTC', { ps: true }), read('Asia/Kolkata', { ps: true }), read('America/Los_Angeles', { ps: true })];
    if (viaPs[0] === null) t.diagnostic('no ps on this host, so the ps path is not exercised');
    else assert.deepEqual(viaPs, [viaPs[0], viaPs[0], viaPs[0]], 'the ps start time ignores the caller\'s TZ');
    // On Linux the default path reads clock ticks since boot, which no zone touches.
    const viaDefault = [read('UTC'), read('Asia/Kolkata')];
    assert.equal(viaDefault[0], viaDefault[1]);
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

test('a server refused the record by a live one takes it over once that one is gone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-port-'));
  const file = join(dir, '.webjs', 'dev-server.json');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Another live server holds the record (a child process, so it can die).
  const holder = spawn(process.execPath, ['--input-type=module', '-e',
    `const { recordDevPort } = await import(${JSON.stringify(PORT_JS)}); recordDevPort(${JSON.stringify(dir)}, 8910); setInterval(() => {}, 1e9);`], { stdio: 'ignore' });
  try {
    const deadline = Date.now() + 10_000;
    while (!existsSync(file) && Date.now() < deadline) await sleep(50);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).pid, holder.pid);
    let port = 8911;
    const first = claimServerRecord(dir, () => port, { kind: 'dev', intervalMs: 100 });
    assert.equal(first?.pid, holder.pid, 'the live holder keeps the record');
    await sleep(300);
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).pid, holder.pid, 'still the holder\'s while it lives');
    // The port to record moves (a dev child reported its bind) before the claim.
    port = 8912;
    // SIGKILL skips the holder's exit handler, so its stale record stays behind.
    holder.kill('SIGKILL');
    const until = Date.now() + 5000;
    let record = null;
    while (Date.now() < until) {
      record = JSON.parse(readFileSync(file, 'utf8'));
      if (record.pid === process.pid) break;
      await sleep(50);
    }
    assert.equal(record?.pid, process.pid, 'this process took the record over');
    assert.equal(record?.port, 8912, 'with the port it serves on now');
  } finally {
    holder.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

const SERVER_RECORD_JS = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../../packages/cli/lib/server-record.js')).href;
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const pidIn = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')).pid; } catch { return null; } };

test('stop leaves a record another server took over while the stopped one exited', async () => {
  // A second server's claim can land between the stopped server exiting and
  // stop's delete; deleting it then left a running server nothing could find.
  // The holder below writes that takeover itself, just before it exits.
  const { stopServers } = await import('../../packages/cli/lib/stop.js');
  const dir = mkdtempSync(join(tmpdir(), 'webjs-stop-race-'));
  mkdirSync(join(dir, 'app'));
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}');
  const file = join(dir, '.webjs/dev-server.json');
  const takeover = JSON.stringify({ port: 2222, pid: process.pid }) + '\n';
  const holder = spawn(process.execPath, ['--input-type=module', '-e',
    `import { writeFileSync } from 'node:fs';
     const { recordServer } = await import(${JSON.stringify(SERVER_RECORD_JS)});
     recordServer(${JSON.stringify(dir)}, 1111, { kind: 'dev' });
     process.on('SIGTERM', () => { writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(takeover)}); process.exit(0); });
     setInterval(() => {}, 1e9);`], { stdio: 'ignore' });
  try {
    const deadline = Date.now() + 10_000;
    while (pidIn(file) !== holder.pid && Date.now() < deadline) await nap(50);
    assert.equal(pidIn(file), holder.pid);
    const code = await stopServers({ cwd: dir, out: () => {}, err: () => {} });
    assert.equal(code, 0);
    assert.equal(pidIn(file), process.pid, 'the record the other server took over was deleted');
  } finally {
    holder.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('claimServerRecord keeps retrying after a failed write', async () => {
  // A write failure (EACCES, ENOSPC) returns null, which used to stop the
  // retry for good, so the server was never recorded once the disk recovered.
  const dir = mkdtempSync(join(tmpdir(), 'webjs-claim-retry-'));
  const file = join(dir, '.webjs/dev-server.json');
  const holder = spawn(process.execPath, ['--input-type=module', '-e',
    `const { recordServer } = await import(${JSON.stringify(SERVER_RECORD_JS)}); recordServer(${JSON.stringify(dir)}, 1111, { kind: 'dev' }); setInterval(() => {}, 1e9);`], { stdio: 'ignore' });
  try {
    const deadline = Date.now() + 10_000;
    while (pidIn(file) !== holder.pid && Date.now() < deadline) await nap(50);
    const first = claimServerRecord(dir, () => 3333, { kind: 'dev', intervalMs: 50 });
    assert.equal(first?.pid, holder.pid);
    chmodSync(file, 0o444);
    holder.kill('SIGKILL');
    await nap(400); // several retries, each failing to write
    chmodSync(file, 0o644);
    const until = Date.now() + 3000;
    while (pidIn(file) !== process.pid && Date.now() < until) await nap(50);
    assert.equal(pidIn(file), process.pid, 'the claim gave up after a failed write');
  } finally {
    holder.kill('SIGKILL');
    try { chmodSync(file, 0o644); } catch { /* removed */ }
    rmSync(dir, { recursive: true, force: true });
  }
});
