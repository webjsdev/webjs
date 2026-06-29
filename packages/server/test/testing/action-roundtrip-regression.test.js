/**
 * Acceptance criterion 6 (#267): a test PROVING `invokeActionForTest` catches a
 * regression a DIRECT import of the action would miss.
 *
 * The whole point of the action round-trip helper is that it exercises the
 * production path (CSRF + the wire serializer + prod error sanitization), which
 * calling the action function directly bypasses. Each case below contrasts the
 * two: the direct call is "blind" to the production concern, while the helper
 * (going through /__webjs/action/<hash>/<fn>) observes it. If the endpoint
 * regressed (CSRF dropped, serializer swapped for plain JSON, error sanitization
 * removed), the helper assertion fails while the direct call keeps passing,
 * which is exactly the gap this proves the helper closes.
 *
 * tmpdir app fixtures, like body-limit/integration.test.js.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { invokeActionForTest, rawActionRequest } from '../../src/testing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/src/html.js')).toString());

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-roundtrip-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

const ACTION_REL = 'modules/m/act.server.js';

function regressionApp() {
  return makeApp({
    'app/page.js':
      `import { html } from ${HTML_URL};\n` +
      `import { sumMap, leak } from '../${ACTION_REL}';\n` +
      `export default () => html\`<p>\${sumMap}\${leak}</p>\`;\n`,
    [ACTION_REL]:
      `'use server';\n` +
      // Takes a Map arg and returns a Map: a plain-JSON wire would lose both.
      `export async function sumMap(m) {\n` +
      `  let total = 0;\n` +
      `  for (const v of m.values()) total += v;\n` +
      `  const out = new Map(m);\n` +
      `  out.set('__total', total);\n` +
      `  return out;\n` +
      `}\n` +
      `export async function leak() {\n` +
      `  const e = new Error('boom message');\n` +
      `  e.secretField = 'DB_PASSWORD=hunter2';\n` +
      `  throw e;\n` +
      `}\n`,
  });
}

/** Import the action module directly (what a "direct import" test does today). */
async function importAction(appDir) {
  const url = pathToFileURL(join(appDir, ACTION_REL)).toString();
  return import(url);
}

test('SERIALIZER: a Map arg+return survives the endpoint but is the proof a JSON wire would lose', async () => {
  const appDir = regressionApp();
  const app = await createRequestHandler({ appDir, dev: true });
  const input = new Map([['a', 2], ['b', 3]]);

  // Direct import: the Map is passed in-process, so of course it is a Map. This
  // assertion can NEVER detect a wire-serializer regression: there is no wire.
  const { sumMap } = await importAction(appDir);
  const direct = await sumMap(input);
  assert.ok(direct instanceof Map, 'direct call trivially keeps the Map (no wire involved)');

  // Through the endpoint: the Map is encoded by the webjs serializer, sent over
  // HTTP, decoded server-side, re-encoded on return, decoded here. It is a Map
  // on BOTH sides ONLY because the rich-type serializer ran. Swap the wire for
  // plain JSON and this returns a plain object -> the assertion fails. That is
  // the regression the helper catches and the direct call cannot.
  const out = await invokeActionForTest(app, ACTION_REL, 'sumMap', [input]);
  assert.ok(out instanceof Map, 'the returned value decoded back to a Map (serializer round-trip ran)');
  assert.equal(out.get('a'), 2);
  assert.equal(out.get('__total'), 5, 'the action received a real Map (could iterate .values())');
});

test('CSRF: the endpoint rejects a request the direct call has no concept of', async () => {
  const appDir = regressionApp();
  const app = await createRequestHandler({ appDir, dev: true });

  // Direct import: there is no request, no CSRF, the call just runs. A CSRF
  // regression is invisible to it.
  const { sumMap } = await importAction(appDir);
  assert.ok(await sumMap(new Map()) instanceof Map, 'direct call ignores CSRF entirely');

  // Through the endpoint cross-origin: 403. If the endpoint stopped enforcing
  // the cross-origin check, this would become 200 and the regression would be
  // caught HERE, never by a direct-import test.
  const res = await rawActionRequest(app, ACTION_REL, 'sumMap', [new Map()], { crossOrigin: true });
  assert.equal(res.status, 403, 'CSRF enforcement is observable only through the endpoint');
});

test('ERROR SANITIZATION: prod hides the thrown error stack/extra fields the direct throw exposes', async () => {
  const appDir = regressionApp();
  // dev: false to run the prod sanitization branch.
  const app = await createRequestHandler({ appDir, dev: false });

  // Direct import: the FULL Error object (stack + secretField) is thrown to the
  // caller. A direct-import test sees everything, so it can never assert that
  // production hides the stack.
  const { leak } = await importAction(appDir);
  await assert.rejects(() => leak(), (e) => {
    assert.equal(e.secretField, 'DB_PASSWORD=hunter2', 'direct throw leaks the secret field');
    assert.ok(typeof e.stack === 'string' && e.stack.length > 0, 'direct throw carries the stack');
    return true;
  });

  // Through the endpoint in prod: the wire payload is sanitized to a GENERIC
  // message plus a correlation digest (#749). No raw message, no stack, no
  // secretField. This is the production guarantee the direct call cannot observe.
  const res = await rawActionRequest(app, ACTION_REL, 'leak', []);
  assert.equal(res.status, 500);
  const text = await res.text();
  const payload = JSON.parse(text);
  assert.equal(payload.error, 'Internal server error', 'prod returns a generic message, not the raw throw');
  assert.ok(typeof payload.digest === 'string' && payload.digest.length >= 6, 'prod returns a correlation digest');
  assert.equal(payload.stack, undefined, 'prod NEVER sends the stack');
  assert.ok(!/boom message/.test(text), 'the raw thrown message is not leaked');
  assert.ok(!/hunter2|secretField|DB_PASSWORD/.test(text), 'no secret field leaks over the wire');
});
