// `webjs test` (server) must discover the documented feature-folder test
// layout (test/<feature>/<name>.test.ts), not just files sitting directly
// in test/. It must skip browser/ subfolders (WTR owns those) and gate
// e2e/ subfolders behind WEBJS_E2E=1.
//
// Regression guard for the non-recursive readdir that silently ran zero
// tests in a scaffolded app, which would have made the scaffolded CI gate
// pass hollow.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'packages', 'cli', 'bin', 'webjs.js',
);

let appDir;

before(() => {
  appDir = mkdtempSync(join(tmpdir(), 'webjs-disc-'));
  const write = (rel, body) => {
    mkdirSync(dirname(join(appDir, rel)), { recursive: true });
    writeFileSync(join(appDir, rel), body);
  };
  // Feature-folder layout: a nested unit test, an e2e test, a browser test.
  write('test/hello/hello.test.ts',
    `import { test } from 'node:test';\ntest('unit', () => {});\n`);
  write('test/hello/e2e/hello.test.ts',
    `import { test } from 'node:test';\ntest('e2e', () => {});\n`);
  write('test/hello/browser/hello.test.js',
    `suite('b', () => { test('x', () => {}); });\n`);
});

after(() => {
  if (appDir) rmSync(appDir, { recursive: true, force: true });
});

function runServerTests(env) {
  const res = spawnSync(process.execPath, [BIN, 'test', '--server'], {
    cwd: appDir, encoding: 'utf8', env: { ...process.env, ...env },
  });
  return `${res.stdout}\n${res.stderr}`;
}

describe('webjs test: server discovery', () => {
  test('recurses into feature folders, skips browser + e2e by default', () => {
    const out = runServerTests({ WEBJS_E2E: '' });
    // The nested unit test is found (1 file), not the browser or e2e file.
    assert.match(out, /running 1 server test file/,
      'discovers the nested unit test and excludes browser + e2e');
  });

  test('WEBJS_E2E=1 adds the e2e layer', () => {
    const out = runServerTests({ WEBJS_E2E: '1' });
    assert.match(out, /running 2 server test file/,
      'unit + e2e run when WEBJS_E2E is set; browser still excluded');
  });
});

// `webjs test --browser` with zero matching browser test files passes with a
// note instead of letting web-test-runner throw `Could not find any test
// files` (#1491): `gallery:clear` removes the last browser test, and the
// scaffold's own `webjs ci` must stay green afterwards.
describe('webjs test: browser layer with no browser tests', () => {
  let emptyApp;
  const CONFIG = join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'packages', 'cli', 'templates', 'web-test-runner.config.js',
  );

  before(() => {
    emptyApp = mkdtempSync(join(tmpdir(), 'webjs-nobrowser-'));
    // The real scaffold config, so the globs are the ones apps ship with.
    writeFileSync(join(emptyApp, 'web-test-runner.config.js'), readFileSync(CONFIG, 'utf8'));
    mkdirSync(join(emptyApp, 'test', 'unit'), { recursive: true });
    writeFileSync(join(emptyApp, 'test', 'unit', 'a.test.ts'),
      `import { test } from 'node:test';\ntest('unit', () => {});\n`);
  });

  after(() => {
    if (emptyApp) rmSync(emptyApp, { recursive: true, force: true });
  });

  function runBrowser() {
    return spawnSync(process.execPath, [BIN, 'test', '--browser'], {
      cwd: emptyApp, encoding: 'utf8', env: { ...process.env },
    });
  }

  test('zero browser test files exits 0 and says so', () => {
    const res = runBrowser();
    const out = `${res.stdout}\n${res.stderr}`;
    assert.equal(res.status, 0, out);
    assert.match(out, /no browser tests yet/);
    assert.doesNotMatch(out, /Could not find any test files/);
  });

  test('with one browser test file, the runner is launched as before', () => {
    // Counterfactual: the skip must not swallow a real suite. This temp app
    // has no @web/test-runner installed, so reaching the launch step is
    // proven by the "not installed" error, which the skip path never prints.
    mkdirSync(join(emptyApp, 'test', 'unit', 'browser'), { recursive: true });
    writeFileSync(join(emptyApp, 'test', 'unit', 'browser', 'b.test.js'),
      `suite('b', () => { test('x', () => {}); });\n`);
    try {
      const res = runBrowser();
      const out = `${res.stdout}\n${res.stderr}`;
      assert.doesNotMatch(out, /no browser tests yet/);
      assert.match(out, /@web\/test-runner is not installed/);
      assert.notEqual(res.status, 0);
    } finally {
      rmSync(join(emptyApp, 'test', 'unit', 'browser'), { recursive: true, force: true });
    }
  });
});
