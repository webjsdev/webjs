import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions, RULES } from '../../src/check.js';

/**
 * Tests for `no-missing-local-import`: a NAMED value import of a symbol a
 * resolvable app-internal module does not export is a runtime crash the
 * elision-based checks miss. The rule fills that gap while staying conservative
 * enough to never false-positive on a valid app (the whole point of it).
 */
const RULE = 'no-missing-local-import';

async function makeApp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-missing-import-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    await writeFile(abs, contents);
  }
  return dir;
}
const hits = (v) => v.filter((x) => x.rule === RULE);

test('the rule is registered', () => {
  assert.ok(RULES.some((r) => r.name === RULE), 'RULES lists no-missing-local-import');
});

test('flags a named import of a symbol the target does not export (the dropped-table case)', async () => {
  const dir = await makeApp({
    'db/schema.server.ts': `export const users = table('users', {});\nexport type User = 1;\n`,
    'modules/todo/create.server.ts': `import { todos } from '../../db/schema.server.ts';\nexport function make() { return todos; }\n`,
  });
  const v = hits(await checkConventions(dir));
  assert.equal(v.length, 1, 'exactly one violation');
  assert.match(v[0].file, /create\.server\.ts/);
  assert.match(v[0].message, /does not export `todos`/);
  await rm(dir, { recursive: true, force: true });
});

test('does NOT flag when the target DOES export the name (counterfactual)', async () => {
  const dir = await makeApp({
    'db/schema.server.ts': `export const users = table('users', {});\nexport const todos = table('todos', {});\n`,
    'modules/todo/create.server.ts': `import { todos, users } from '../../db/schema.server.ts';\nexport function m() { return [todos, users]; }\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0);
  await rm(dir, { recursive: true, force: true });
});

test('is silent on a type import, a default/namespace import, and a bare specifier', async () => {
  const dir = await makeApp({
    'db/schema.server.ts': `export const users = table('users', {});\n`,
    'lib/x.ts': `export default 1;\nexport const y = 2;\n`,
    // type import of a missing name -> tsc's job, not this rule
    'a.ts': `import type { Gone } from './db/schema.server.ts';\nexport const a: Gone = 1;\n`,
    // default + namespace import -> no named value to verify
    'b.ts': `import def, * as ns from './lib/x.ts';\nexport const b = [def, ns];\n`,
    // bare npm specifier -> not app-internal, skipped
    'c.ts': `import { anything } from 'some-pkg';\nexport const c = anything;\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0);
  await rm(dir, { recursive: true, force: true });
});

test('resolves a re-export barrel (export { X } from) and the `as` alias', async () => {
  const dir = await makeApp({
    'components/button.ts': `export const Button = 1;\n`,
    'components/index.ts': `export { Button } from './button.ts';\nexport { Button as PrimaryButton } from './button.ts';\n`,
    'ok.ts': `import { Button, PrimaryButton } from './components/index.ts';\nexport const u = [Button, PrimaryButton];\n`,
    'bad.ts': `import { Ghost } from './components/index.ts';\nexport const g = Ghost;\n`,
  });
  const v = hits(await checkConventions(dir));
  assert.equal(v.length, 1, 'only the truly-missing Ghost is flagged');
  assert.match(v[0].file, /bad\.ts/);
  await rm(dir, { recursive: true, force: true });
});

test('bails (flags nothing) when the target has a star re-export or destructuring export', async () => {
  const dir = await makeApp({
    'star.ts': `export * from './somewhere.ts';\n`,
    'destructure.ts': `export const { a, b } = obj;\n`,
    'i1.ts': `import { whatever } from './star.ts';\nexport const x = whatever;\n`,
    'i2.ts': `import { c } from './destructure.ts';\nexport const y = c;\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0, 'unknowable exports -> no flag');
  await rm(dir, { recursive: true, force: true });
});

test('does NOT flag a commented-out import of a missing name', async () => {
  const dir = await makeApp({
    'db/schema.server.ts': `export const users = table('users', {});\n`,
    'x.ts': `// import { todos } from './db/schema.server.ts';\nexport const x = 1;\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0);
  await rm(dir, { recursive: true, force: true });
});

// The three false-positive regressions the review found.

test('FP: a multi-declarator export is bailed, not under-counted', async () => {
  const dir = await makeApp({
    'lib/consts.ts': `export const FOO = 1, BAR = 2;\nexport const inits = fn(a, b), zed = [1, 2];\n`,
    'use.ts': `import { FOO, BAR, zed } from './lib/consts.ts';\nexport const u = [FOO, BAR, zed];\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0, 'multi-declarator module is treated as unknowable');
  await rm(dir, { recursive: true, force: true });
});

test('FP: an import statement inside a string or template is not matched', async () => {
  const dir = await makeApp({
    'lib/utils.ts': `export const real = 1;\n`,
    'a.ts': `export const s = "import { missingName } from './lib/utils.ts'";\n`,
    'b.ts': "export const t = `<pre>import { gone } from './lib/utils.ts'</pre>`;\n",
    'c.ts': `import { real } from './lib/utils.ts';\nexport const c = real;\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0, 'only the genuine import is considered, and it resolves');
  await rm(dir, { recursive: true, force: true });
});

test('FP: a side-effect import followed by braced code does not bleed into the next import', async () => {
  const dir = await makeApp({
    'lib/side.ts': `export const noop = 1;\n`,
    'lib/utils.ts': `export const realFn = 1;\n`,
    'x.ts': `import './lib/side.ts';\nconst opts = { notAnExport };\nimport { realFn } from './lib/utils.ts';\nexport const x = [opts, realFn];\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0, 'notAnExport is not misattributed to utils.ts');
  await rm(dir, { recursive: true, force: true });
});

test('FP: an exported generator is collected in every star position', async () => {
  const dir = await makeApp({
    'lib/g.ts': `export function* a(){}\nexport function *b(){}\nexport function*c(){}\nexport async function* d(){}\nexport async function *e(){}\n`,
    'use.ts': `import { a, b, c, d, e } from './lib/g.ts';\nexport const u = [a, b, c, d, e];\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0, 'no star-placement is treated as a missing export');
  await rm(dir, { recursive: true, force: true });
});

test('a generic type annotation does not disable the rule (comma inside Map<> is not a declarator)', async () => {
  const dir = await makeApp({
    'lib/store.ts': `export const cache: Map<string, number> = new Map();\nexport const real = 1;\n`,
    'ok.ts': `import { cache, real } from './lib/store.ts';\nexport const o = [cache, real];\n`,
    'bad.ts': `import { gone } from './lib/store.ts';\nexport const b = gone;\n`,
  });
  const v = hits(await checkConventions(dir));
  assert.equal(v.length, 1, 'the module is still checked despite the generic annotation');
  assert.match(v[0].file, /bad\.ts/);
  assert.match(v[0].message, /does not export `gone`/);
  await rm(dir, { recursive: true, force: true });
});

test('a real multi-declarator with a ternary or comparison first initializer is still bailed', async () => {
  const dir = await makeApp({
    'lib/m.ts': `export const x = cond ? a : b, y = 2;\nexport const p = q < r, s = 3;\n`,
    'use.ts': `import { y, s } from './lib/m.ts';\nexport const u = [y, s];\n`,
  });
  assert.equal(hits(await checkConventions(dir)).length, 0, 'multi-declarator bail holds through a ternary/comparison init');
  await rm(dir, { recursive: true, force: true });
});
