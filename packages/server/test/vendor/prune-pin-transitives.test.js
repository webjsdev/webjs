// prunePinToReachable keeps the transitive dependencies of what app code
// reaches (#1518). App code never imports a transitive (`@codemirror/view`
// imports `style-mod`), so a prune by reachability alone served a map without
// them and the browser could not resolve the bare specifier.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { prunePinToReachable } from '../../src/vendor.js';

let root;
before(() => { root = mkdtempSync(join(tmpdir(), 'webjs-prune-trans-')); });
after(() => { rmSync(root, { recursive: true, force: true }); });

/** Install a fake package at `<dir>/node_modules/<name>`. */
function pkg(dir, name, deps = {}, field = 'dependencies') {
  const d = join(dir, 'node_modules', name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name, version: '1.0.0', main: 'index.js', [field]: deps }));
  writeFileSync(join(d, 'index.js'), 'module.exports = {};\n');
  return d;
}

function app(declared) {
  const dir = mkdtempSync(join(root, 'app-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', dependencies: declared }));
  return dir;
}

const url = (n) => `https://ga.jspm.io/npm:${n}@1.0.0/index.js`;
function pin(names) {
  const imports = {};
  const integrity = {};
  for (const n of names) { imports[n] = url(n); integrity[url(n)] = `sha384-${n.replace(/[^a-z]/g, '')}`; }
  return { imports, integrity };
}

test('keeps every transitive of a reachable package, and drops an unreachable one with its own', () => {
  const dir = app({ '@cm/view': '1', unused: '1' });
  pkg(dir, '@cm/view', { 'style-mod': '1', '@cm/state': '1' });
  pkg(dir, '@cm/state', { '@marijn/find-cluster-break': '1' });
  pkg(dir, 'style-mod');
  pkg(dir, '@marijn/find-cluster-break');
  pkg(dir, 'unused', { 'unused-leaf': '1' });
  pkg(dir, 'unused-leaf');
  const { imports, integrity } = pin(['@cm/view', '@cm/state', 'style-mod', '@marijn/find-cluster-break', 'unused', 'unused-leaf']);
  const out = prunePinToReachable(imports, integrity, new Set(['@cm/view']), { appDir: dir });
  assert.deepEqual(Object.keys(out.imports).sort(), ['@cm/state', '@cm/view', '@marijn/find-cluster-break', 'style-mod']);
  assert.deepEqual(Object.keys(out.integrity).sort(), Object.values(out.imports).sort(), 'every kept URL keeps its hash');
});

test('a peer dependency counts, and a nested install is found from its dependent', () => {
  const dir = app({ top: '1' });
  const top = pkg(dir, 'top', { nested: '1' });
  pkg(top, 'nested', { peer: '1' }, 'peerDependencies'); // top/node_modules/nested
  pkg(dir, 'peer');
  const { imports, integrity } = pin(['top', 'nested', 'peer']);
  const out = prunePinToReachable(imports, integrity, new Set(['top']), { appDir: dir });
  assert.deepEqual(Object.keys(out.imports).sort(), ['nested', 'peer', 'top']);
});

test('a dependency cycle terminates', () => {
  const dir = app({ a: '1' });
  pkg(dir, 'a', { b: '1' });
  pkg(dir, 'b', { a: '1' });
  const { imports, integrity } = pin(['a', 'b']);
  const out = prunePinToReachable(imports, integrity, new Set(['a']), { appDir: dir });
  assert.deepEqual(Object.keys(out.imports).sort(), ['a', 'b']);
});

test('with a reachable package missing from disk, every entry the app does not declare is kept', () => {
  const dir = app({ '@cm/view': '1', dayjs: '1' }); // nothing installed
  const { imports, integrity } = pin(['@cm/view', 'style-mod', 'crelt', 'dayjs']);
  const out = prunePinToReachable(imports, integrity, new Set(['@cm/view']), { appDir: dir });
  assert.deepEqual(Object.keys(out.imports).sort(), ['@cm/view', 'crelt', 'style-mod'],
    'transitives kept; the declared but unreachable dayjs is still pruned (#197)');
});

test('without appDir the prune is the reachability filter it always was (#197)', () => {
  const { imports, integrity } = pin(['@cm/view', 'style-mod']);
  const out = prunePinToReachable(imports, integrity, new Set(['@cm/view']));
  assert.deepEqual(Object.keys(out.imports), ['@cm/view']);
});
