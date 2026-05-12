/**
 * Tests for the hand-rolled `cn()` helper that lives in
 * `packages/registry/lib/utils.ts`. We exercise the dedupe groups that
 * components actually rely on — specifically the `text-size` vs `text-color`
 * split that regressed once when both buckets were collapsed into a single
 * `text-` group (text-sm got eaten by text-primary-foreground).
 *
 * The helper is shipped to user projects verbatim. To run it in the plain
 * Node test runner we transform the .ts source via esbuild (already a
 * transitive dep through @webjskit/server) and import the JS module.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { transformSync } from 'esbuild';

const UTILS_SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages',
  'registry',
  'lib',
  'utils.ts',
);

const ts = readFileSync(UTILS_SRC, 'utf8');
const { code: js } = transformSync(ts, { loader: 'ts', format: 'esm', target: 'es2022' });
const dir = mkdtempSync(join(tmpdir(), 'webjs-ui-cn-'));
const file = join(dir, 'utils.mjs');
writeFileSync(file, js);
const { cn } = await import(pathToFileURL(file).href);

test('cn: joins truthy values with spaces', () => {
  assert.equal(cn('a', 'b', 'c'), 'a b c');
  assert.equal(cn('a', false, 'b', null, 'c', undefined), 'a b c');
});

test('cn: dedupes background-color (last wins)', () => {
  assert.equal(cn('bg-red-500', 'bg-blue-500'), 'bg-blue-500');
});

test('cn: text-size and text-color are SEPARATE groups (regression: text-sm survived next to text-primary)', () => {
  const result = cn('text-sm', 'text-primary-foreground');
  assert.match(result, /text-sm/, 'text-sm must survive');
  assert.match(result, /text-primary-foreground/, 'text-primary-foreground must survive');
});

test('cn: dedupes only same group — h-9 vs h-12 (last wins) but h-9 + w-full coexist', () => {
  assert.equal(cn('h-9', 'h-12'), 'h-12');
  const out = cn('h-9', 'w-full');
  assert.match(out, /h-9/);
  assert.match(out, /w-full/);
});

test('cn: padding subgroups — px-4 + py-2 coexist; px-4 + px-6 collapses to px-6', () => {
  assert.equal(cn('px-4', 'px-6'), 'px-6');
  const out = cn('px-4', 'py-2');
  assert.match(out, /px-4/);
  assert.match(out, /py-2/);
});

test('cn: variant prefixes (hover:, dark:) dedupe within their own variant only', () => {
  const out = cn('bg-white', 'hover:bg-blue-500', 'hover:bg-red-500');
  assert.match(out, /bg-white/);
  assert.match(out, /hover:bg-red-500/);
  assert.doesNotMatch(out, /hover:bg-blue-500/);
});

test('cn: rounded variants collapse to last', () => {
  assert.equal(cn('rounded-md', 'rounded-full'), 'rounded-full');
  assert.equal(cn('rounded', 'rounded-full'), 'rounded-full');
});

test('Base export exists and is a constructor (HTMLElement in browser, stub in Node)', async () => {
  const utils = await import(pathToFileURL(file).href);
  assert.equal(typeof utils.Base, 'function');
});

test('defineElement is a no-op when customElements is undefined (server)', async () => {
  const utils = await import(pathToFileURL(file).href);
  assert.equal(typeof utils.defineElement, 'function');
  // Should not throw on the server where `customElements` is absent.
  utils.defineElement('ui-noop-test', class {});
});
