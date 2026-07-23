/**
 * Tests for the hand-rolled `cn()` helper that lives in
 * `packages/registry/lib/utils.ts`. We exercise the dedupe groups that
 * components actually rely on: specifically the `text-size` vs `text-color`
 * split that regressed once when both buckets were collapsed into a single
 * `text-` group (text-sm got eaten by text-primary-foreground).
 *
 * The helper is shipped to user projects verbatim. To run it in the plain
 * Node test runner we strip its TypeScript types via Node 24+'s built-in
 * `module.stripTypeScriptTypes` (the same primitive `webjs dev` uses) and
 * import the resulting JS module.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
// Framework's runtime-portable stripper (built-in on Node, amaro on Bun), NOT a
// named `import { stripTypeScriptTypes } from 'node:module'` (a LINK-TIME error
// on Bun, where the export is absent).
import { stripTypeScript } from '../../server/src/ts-strip.js';

const UTILS_SRC = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages',
  'registry',
  'lib',
  'utils.ts',
);

const ts = readFileSync(UTILS_SRC, 'utf8');
const js = await stripTypeScript(ts);
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

test('cn: dedupes only same group: h-9 vs h-12 (last wins) but h-9 + w-full coexist', () => {
  assert.equal(cn('h-9', 'h-12'), 'h-12');
  const out = cn('h-9', 'w-full');
  assert.match(out, /h-9/);
  assert.match(out, /w-full/);
});

test('cn: padding subgroups: px-4 + py-2 coexist; px-4 + px-6 collapses to px-6', () => {
  assert.equal(cn('px-4', 'px-6'), 'px-6');
  const out = cn('px-4', 'py-2');
  assert.match(out, /px-4/);
  assert.match(out, /py-2/);
});

test('cn: a shorthand overrides the axis/side it subsumes (the icon-button gap)', () => {
  // The bug this fixes: buttonClass() ships px-4 py-2, and cn(..., 'p-0') used to
  // keep all three (unreliable). A shorthand now wins over what it subsumes.
  assert.equal(cn('px-4', 'py-2', 'p-0'), 'p-0');
  // Directional, not symmetric: shorthand THEN axis refines (both survive);
  // axis THEN shorthand collapses to the shorthand.
  assert.equal(cn('p-4', 'px-2'), 'p-4 px-2');
  assert.equal(cn('px-2', 'p-4'), 'p-4');
  // Side vs axis: a later px removes an earlier pl/pr; a later side refines px.
  assert.equal(cn('pl-1', 'px-2'), 'px-2');
  assert.equal(cn('px-2', 'pl-1'), 'px-2 pl-1');
  // Margin behaves the same; size subsumes w and h.
  assert.equal(cn('mx-4', 'm-0'), 'm-0');
  assert.equal(cn('w-8', 'size-4'), 'size-4');
  // Conflicts stay within a variant (a hover: shorthand does not touch a base axis).
  assert.equal(cn('px-4', 'hover:p-0'), 'px-4 hover:p-0');
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

// The old `Base` / `defineElement` HTMLElement-era helpers were removed in #819
// (the registry components extend `WebComponent` from `@webjsdev/core` now, and
// keeping them referenced `HTMLElement` / `customElements` at module scope, which
// pinned every page importing `cn`). Their absence + cn's purity is guarded by
// `utils-purity.test.js`.
test('Base and defineElement are no longer exported (removed in #819)', async () => {
  const utils = await import(pathToFileURL(file).href);
  assert.equal(utils.Base, undefined, 'Base was removed');
  assert.equal(utils.defineElement, undefined, 'defineElement was removed');
});
