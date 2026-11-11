/**
 * `webjs dev` records the port it serves on and `webjs status` reads it back
 * (#1686). An eval agent started the dev server with `--port 8910`, then ran
 * `webjs status`, which looked at the 8080 default, found nothing, and booted a
 * second in-process copy instead of reporting on the server that was up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { recordDevPort, recordedDevPort } from '../../packages/cli/lib/port.js';
import { isLiveServer, processStartTime } from '../../packages/cli/lib/server-record.js';

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
