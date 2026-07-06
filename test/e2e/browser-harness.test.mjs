/**
 * E2E for the browser-test harness (#806).
 *
 * Spawns the REAL `wtr` with the shipped scaffold `web-test-runner.config.js`
 * against a fixture app (test/e2e/fixtures/harness-app) whose browser test
 * imports a real `.ts` component that imports a `'use server'` action. It only
 * passes if the harness serves that component through the webjs dev pipeline
 * (TypeScript stripped, the `.server.ts` import rewritten to an RPC stub,
 * `@webjsdev/core` resolved via the injected importmap) and it loads + upgrades
 * in real Chromium. Plain web-test-runner (raw TS, no stub, no importmap) fails
 * this, which is the whole point of #806.
 *
 * Runs in the E2E CI job (Chromium installed, and the ws WebSocket subsystem
 * loads there). Opt in with WEBJS_E2E=1.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = join(ROOT, 'test', 'e2e', 'fixtures', 'harness-app');
const WTR = join(ROOT, 'node_modules', '.bin', 'wtr');

describe('E2E: browser-test harness (#806)', { skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests' }, () => {
  test('wtr + the harness config loads a real component (with a use-server action) in Chromium', async () => {
    const code = await new Promise((res, rej) => {
      const child = spawn(WTR, ['--config', 'web-test-runner.config.js'], {
        cwd: FIXTURE,
        // The scaffold config pins chromium; WEBJS_BROWSERS is a no-op for it,
        // set anyway so any shared launcher stays on the installed engine.
        env: { ...process.env, WEBJS_BROWSERS: 'chromium' },
        stdio: 'inherit',
      });
      child.on('exit', res);
      child.on('error', rej);
    });
    assert.equal(code, 0, 'the harness browser test passed in a real browser via wtr');
  });
});
