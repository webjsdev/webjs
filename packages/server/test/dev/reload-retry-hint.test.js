/**
 * #893: the dev SSE stream sends a short `retry:` hint so the browser's
 * EventSource reconnects quickly after a `node --watch` restart (its default
 * backoff is ~3s). That reconnect is what re-triggers a reload for an edit whose
 * in-process reload frame was killed with the old process, so a slow reconnect
 * would make an app edit feel like it needs a manual refresh. Booting the real
 * server is the point: the hint is written by the listener shell, not the
 * handler, so only a live connection to `/__webjs/events` proves it ships.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startServer } from '../../src/dev.js';

function makeApp() {
  const appDir = mkdtempSync(join(tmpdir(), 'webjs-retry-'));
  mkdirSync(join(appDir, 'app'), { recursive: true });
  writeFileSync(join(appDir, 'app', 'page.js'), "export default function P() { return 'ok'; }\n");
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'x', type: 'module' }));
  return appDir;
}

/** Read the first SSE chunk (the hello frame) from /__webjs/events. */
function firstFrame(port, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; try { req.destroy(); } catch {} resolve(v); } };
    const req = get({ port, path: '/__webjs/events', headers: { accept: 'text/event-stream' } }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (c) => finish(c));
    });
    req.on('error', () => finish(''));
    setTimeout(() => finish(''), ms);
  });
}

test('the dev SSE hello frame carries a short retry hint for fast reconnect (#893)', async () => {
  const srv = await startServer({ appDir: makeApp(), port: 0, dev: true });
  const port = srv.server.address().port;
  try {
    const frame = await firstFrame(port, 4000);
    assert.match(frame, /(^|\n)retry: 300(\n|$)/, 'the stream sets a 300ms reconnect backoff');
    assert.match(frame, /event: hello/, 'the hello frame still opens the stream');
  } finally {
    await srv.close();
  }
});
