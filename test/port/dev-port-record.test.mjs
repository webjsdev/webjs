/**
 * `webjs dev` records the port it serves on and `webjs status` reads it back
 * (#1686). An eval agent started the dev server with `--port 8910`, then ran
 * `webjs status`, which looked at the 8080 default, found nothing, and booted a
 * second in-process copy instead of reporting on the server that was up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { recordDevPort, recordedDevPort } from '../../packages/cli/lib/port.js';

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
