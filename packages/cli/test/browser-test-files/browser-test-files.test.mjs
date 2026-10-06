// Unit tests for the zero-browser-tests pre-check behind `webjs test --browser`
// (#1491): reading the `files` globs out of a web-test-runner config's source,
// and matching them against the app tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWtrFilePatterns, findBrowserTestFiles } from '../../lib/browser-test-files.js';

const TEMPLATE_CONFIG = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'web-test-runner.config.js');

test('reads the scaffold config globs, whose /**/ must not read as a comment', () => {
  const patterns = readWtrFilePatterns(readFileSync(TEMPLATE_CONFIG, 'utf8'));
  assert.deepEqual(patterns, [
    'test/**/browser/**/*.test.js',
    'app/**/browser/**/*.test.js',
    'modules/**/browser/**/*.test.js',
    'components/**/browser/**/*.test.js',
  ]);
});

test('reads a single string glob and an empty array', () => {
  assert.deepEqual(readWtrFilePatterns(`export default { files: 'a/**/*.test.js', x: 1 }`), ['a/**/*.test.js']);
  assert.deepEqual(readWtrFilePatterns(`export default { files: [] }`), []);
});

test('a commented-out files key is ignored', () => {
  const src = `export default {\n  // files: ['nope/*.js'],\n  /* files: ['nope2'] */\n  files: ["yes/**/*.test.js",],\n};`;
  assert.deepEqual(readWtrFilePatterns(src), ['yes/**/*.test.js']);
});

test('a non-literal files value is unknown (null), so the caller runs WTR as before', () => {
  assert.equal(readWtrFilePatterns(`export default { files: globs }`), null);
  assert.equal(readWtrFilePatterns(`export default { files: [...base, 'x'] }`), null);
  assert.equal(readWtrFilePatterns(`export default { browsers: [] }`), null);
});

test('findBrowserTestFiles matches includes, honours ! excludes, skips node_modules', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-btf-'));
  try {
    const write = (rel) => {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), '');
    };
    write('test/a/browser/one.test.js');
    write('modules/m/components/browser/two.test.js');
    write('test/a/unit.test.ts');
    write('node_modules/pkg/test/x/browser/three.test.js');
    const patterns = ['test/**/browser/**/*.test.js', 'modules/**/browser/**/*.test.js'];
    assert.deepEqual((await findBrowserTestFiles(dir, patterns)).sort(), [
      'modules/m/components/browser/two.test.js',
      'test/a/browser/one.test.js',
    ]);
    assert.deepEqual(await findBrowserTestFiles(dir, [...patterns, '!modules/**']), ['test/a/browser/one.test.js']);
    assert.deepEqual(await findBrowserTestFiles(dir, ['./test/**/browser/**/*.test.js']), ['test/a/browser/one.test.js']);
    assert.deepEqual(await findBrowserTestFiles(dir, ['app/**/browser/**/*.test.js']), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
