/**
 * Server-side action AbortSignal (#492). The action can read the request's
 * AbortSignal via actionSignal() and stop work on disconnect/abort.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { actionSignal, runWithActionSignal } from '../../src/action-signal.js';
import { createRequestHandler } from '../../src/dev.js';
import { hashFile } from '../../src/actions.js';
import { stringify, parse } from '@webjsdev/core';

test('actionSignal returns a never-aborting signal outside an action', () => {
  assert.equal(actionSignal().aborted, false);
});

test('runWithActionSignal exposes the signal to actionSignal', () => {
  const c = new AbortController();
  runWithActionSignal(c.signal, () => { assert.equal(actionSignal(), c.signal); });
  // Cleared outside the scope.
  assert.notEqual(actionSignal(), c.signal);
});

test('an aborted request signal is visible to the action', async () => {
  const c = new AbortController();
  c.abort();
  await runWithActionSignal(c.signal, async () => {
    assert.equal(actionSignal().aborted, true);
  });
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNAL_URL = pathToFileURL(resolve(__dirname, '../../src/action-signal.js')).toString();
const CORE_URL = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

let tmpRoot, appDir, handle, hash;
before(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-asig-'));
  appDir = mkdtempSync(join(tmpRoot, 'app-'));
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'asig', type: 'module', webjs: {} }));
  const w = (rel, body) => { const abs = join(appDir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); return abs; };
  const f = w('actions/probe.server.js',
    `'use server';\n` +
    `import { actionSignal } from ${JSON.stringify(SIGNAL_URL)};\n` +
    `export async function probe() { return { aborted: actionSignal().aborted }; }\n`);
  w('app/layout.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ({children})=>html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  w('app/page.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ()=>html\`<main>ok</main>\`;\n`);
  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  handle = app.handle;
  hash = await hashFile(f);
});
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

test('the action sees the request AbortSignal through invokeAction', async () => {
  const csrfRes = await handle(new Request('http://localhost/'));
  const m = (csrfRes.headers.get('set-cookie') || '').match(/webjs_csrf=([^;]+)/);
  const token = m ? decodeURIComponent(m[1]) : '';
  const headers = { 'content-type': 'application/vnd.webjs+json', 'x-webjs-csrf': token, cookie: `webjs_csrf=${token}` };

  // A live (non-aborted) request: the action sees aborted=false.
  const live = await handle(new Request(`http://localhost/__webjs/action/${hash}/probe`, { method: 'POST', body: await stringify([]), headers }));
  assert.deepEqual(parse(await live.text()), { aborted: false });

  // An already-aborted request signal: the action sees aborted=true.
  const c = new AbortController(); c.abort();
  const aborted = await handle(new Request(`http://localhost/__webjs/action/${hash}/probe`, { method: 'POST', body: await stringify([]), headers, signal: c.signal }));
  assert.deepEqual(parse(await aborted.text()), { aborted: true });
});
