import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAppTasks } from '../../lib/app-tasks.js';

/** Build an injectable reader that returns the given package.json text. */
function reader(pkgJson) {
  return (_p) => (pkgJson === null ? (() => { throw new Error('ENOENT'); })() : pkgJson);
}

test('reads dev.before, dev.parallel, and start.before from the webjs block', () => {
  const pkg = JSON.stringify({
    webjs: {
      dev: { before: ['prisma generate'], parallel: ['tailwindcss --watch'] },
      start: { before: ['prisma migrate deploy'] },
    },
  });
  const tasks = readAppTasks('/app', reader(pkg));
  assert.deepEqual(tasks.dev.before, ['prisma generate']);
  assert.deepEqual(tasks.dev.parallel, ['tailwindcss --watch']);
  assert.deepEqual(tasks.start.before, ['prisma migrate deploy']);
});

test('missing webjs block yields empty arrays (plain app unchanged)', () => {
  const tasks = readAppTasks('/app', reader(JSON.stringify({ name: 'x' })));
  assert.deepEqual(tasks, { dev: { before: [], parallel: [] }, start: { before: [] } });
});

test('missing/unparseable package.json yields empty arrays, never throws', () => {
  const empty = { dev: { before: [], parallel: [] }, start: { before: [] } };
  assert.deepEqual(readAppTasks('/app', reader(null)), empty);
  assert.deepEqual(readAppTasks('/app', reader('not json')), empty);
});

test('drops non-string and blank entries defensively', () => {
  const pkg = JSON.stringify({
    webjs: { dev: { parallel: ['ok', '', '   ', 42, null] } },
  });
  assert.deepEqual(readAppTasks('/app', reader(pkg)).dev.parallel, ['ok']);
});

test('counterfactual: a non-array before/parallel is ignored, not spread', () => {
  // If the normalizer did not guard the type, a string "tailwindcss" would be
  // spread into ['t','a','i',...]. Assert it is coerced to [] instead.
  const pkg = JSON.stringify({
    webjs: { dev: { before: 'prisma generate', parallel: 'tailwindcss' } },
  });
  const tasks = readAppTasks('/app', reader(pkg));
  assert.deepEqual(tasks.dev.before, []);
  assert.deepEqual(tasks.dev.parallel, []);
});
