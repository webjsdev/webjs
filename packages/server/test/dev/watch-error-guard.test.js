/**
 * The dev process handler's watcher-error guard (#1521). On Node 24 a per-file
 * EACCES inside a recursive watch surfaced as an uncaughtException, and
 * `installProcessHandlers` treated every uncaughtException as fatal, so one
 * unreadable temp file shut the whole dev server down. In dev an error with
 * `syscall: 'watch'` is now a warning; anything else, and every uncaught error
 * in prod, still starts the fatal shutdown.
 *
 * Each case runs in its own process, because the handlers are real
 * `process.on` listeners installed once per process.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const CORE = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '../../src/listener-core.js')).href;

/**
 * Install the handlers, throw `error` uncaught, and report what happened.
 * @param {{ dev: boolean, error: string }} c
 */
function run({ dev, error }) {
  const src = `
    import { installProcessHandlers } from ${JSON.stringify(CORE)};
    const logger = { info() {}, warn: (m) => console.log('WARN ' + m), error: (m) => console.log('ERROR ' + m) };
    installProcessHandlers(logger, () => { console.log('FATAL'); process.exit(1); }, { dev: ${dev} });
    setTimeout(() => { throw ${error}; }, 0);
    setTimeout(() => { console.log('ALIVE'); process.exit(0); }, 100);
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', src], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout };
}

const WATCH_ERR = "Object.assign(new Error('EACCES: permission denied, watch'), { code: 'EACCES', syscall: 'watch', path: '/app/modules/sedyLKmba' })";

test('dev: an uncaught watcher error is one warning, and the server keeps running', () => {
  const r = run({ dev: true, error: WATCH_ERR });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /WARN file watcher skipped \/app\/modules\/sedyLKmba \(EACCES\)/);
  assert.match(r.out, /ALIVE/);
  assert.doesNotMatch(r.out, /FATAL/);
});

test('dev: any other uncaught exception is still fatal', () => {
  const r = run({ dev: true, error: "new TypeError('boom')" });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FATAL/);
});

test('prod: a watcher error stays fatal (the strict contract is unchanged)', () => {
  const r = run({ dev: false, error: WATCH_ERR });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FATAL/);
});
