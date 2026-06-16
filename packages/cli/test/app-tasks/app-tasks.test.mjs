import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAppTasks } from '../../lib/app-tasks.js';

/** Build an injectable reader that returns the given package.json text. */
function reader(pkgJson) {
  return (_p) => (pkgJson === null ? (() => { throw new Error('ENOENT'); })() : pkgJson);
}

test('reads dev.parallel and start.before from the webjs block', () => {
  const pkg = JSON.stringify({
    webjs: {
      dev: { parallel: ['tailwindcss --watch'] },
      start: { before: ['webjs db migrate'] },
    },
  });
  const tasks = readAppTasks('/app', reader(pkg));
  assert.deepEqual(tasks.dev.parallel, ['tailwindcss --watch']);
  assert.deepEqual(tasks.start.before, ['webjs db migrate']);
});

test('missing webjs block yields empty arrays (plain app unchanged)', () => {
  const tasks = readAppTasks('/app', reader(JSON.stringify({ name: 'x' })));
  assert.deepEqual(tasks.dev.parallel, []);
  assert.deepEqual(tasks.start.before, []);
});

test('missing/unparseable package.json yields empty arrays, never throws', () => {
  assert.deepEqual(readAppTasks('/app', reader(null)), {
    dev: { parallel: [] },
    start: { before: [] },
  });
  assert.deepEqual(readAppTasks('/app', reader('not json')), {
    dev: { parallel: [] },
    start: { before: [] },
  });
});

test('drops non-string and blank entries defensively', () => {
  const pkg = JSON.stringify({
    webjs: { dev: { parallel: ['ok', '', '   ', 42, null] } },
  });
  assert.deepEqual(readAppTasks('/app', reader(pkg)).dev.parallel, ['ok']);
});

test('counterfactual: a non-array parallel is ignored, not spread', () => {
  // If the normalizer did not guard the type, a string "tailwindcss" would be
  // spread into ['t','a','i',...]. Assert it is coerced to [] instead.
  const pkg = JSON.stringify({ webjs: { dev: { parallel: 'tailwindcss' } } });
  assert.deepEqual(readAppTasks('/app', reader(pkg)).dev.parallel, []);
});
