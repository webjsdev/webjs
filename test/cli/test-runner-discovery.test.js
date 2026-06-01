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
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
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
