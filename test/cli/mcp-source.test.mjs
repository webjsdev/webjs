/**
 * Unit tests for the `source` tool (#378): `mcp-source.js`. The grep/read/list
 * logic is driven with an INJECTED fake framework tree (no real fs), so it is
 * deterministic; `resolveFrameworkRoots` is additionally exercised against the
 * real monorepo (it must find every `@webjsdev/*` package) and a fail-soft path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const {
  resolveFrameworkRoots,
  walkSource,
  listSources,
  grepSources,
  readSource,
  runSourceTool,
} = await import(resolve(REPO, 'packages', 'cli', 'lib', 'mcp-source.js'));

/** An in-memory framework tree: core (src/), server (src/), cli (lib/). */
function fakeTree(extraFiles = {}) {
  const files = {
    '/fw/core/src/render-client.js': '// hydration\nexport function hydrate() {}\n',
    '/fw/core/src/html.js': 'export const html = 1;\n',
    '/fw/core/src/dir/util.js': 'export const x = signal();\n',
    '/fw/server/src/ssr.js': 'export async function renderToString() {}\n',
    '/fw/cli/lib/mcp.js': '// cli source lives in lib\n',
    ...extraFiles,
  };
  const dirChildren = {};
  for (const p of Object.keys(files)) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join('/') || '/';
      const child = parts[i];
      (dirChildren[d] ||= new Set()).add(child + (i < parts.length - 1 ? '/' : ''));
    }
  }
  const isDir = (p) => dirChildren[p] !== undefined;
  const readdir = (d) => {
    const kids = dirChildren[d];
    if (!kids) throw new Error('ENOENT ' + d);
    return [...kids].map((k) => ({ name: k.replace(/\/$/, ''), isDir: k.endsWith('/') }));
  };
  const readFile = async (p) => {
    if (!(p in files)) throw new Error('ENOENT ' + p);
    return files[p];
  };
  const roots = [
    { pkg: 'core', root: '/fw/core', src: '/fw/core/src' },
    { pkg: 'server', root: '/fw/server', src: '/fw/server/src' },
    { pkg: 'cli', root: '/fw/cli', src: '/fw/cli/lib' },
  ];
  return { roots, readFile, readdir, isDir };
}

test('walkSource: recurses, returns text files, skips node_modules/dist', () => {
  const t = fakeTree({ '/fw/core/src/node_modules/dep/x.js': 'skip me\n', '/fw/core/src/logo.png': 'binary' });
  const files = walkSource('/fw/core/src', t);
  assert.ok(files.includes('/fw/core/src/html.js'));
  assert.ok(files.includes('/fw/core/src/dir/util.js'), 'recurses into subdirs');
  assert.ok(!files.some((f) => f.includes('node_modules')), 'skips node_modules');
  assert.ok(!files.some((f) => f.endsWith('.png')), 'skips non-text');
});

test('listSources: lists packages + entry points; cli uses lib/ not src/', () => {
  const out = listSources(fakeTree());
  assert.match(out, /@webjsdev\/core\/src:/);
  assert.match(out, /core\/src\/html\.js/);
  assert.match(out, /@webjsdev\/cli\/lib:/, 'cli source dir is lib, labelled correctly');
  assert.match(out, /cli\/lib\/mcp\.js/);
  // package filter
  const justServer = listSources(fakeTree(), 'server');
  assert.match(justServer, /@webjsdev\/server\/src:/);
  assert.ok(!/@webjsdev\/core/.test(justServer), 'filter limits to one package');
  // unresolvable package
  assert.match(listSources(fakeTree(), 'nope'), /not installed\/resolvable/);
});

test('grepSources: returns pkg-qualified file:line hits; no-match message', async () => {
  const hits = await grepSources(fakeTree(), 'signal');
  assert.match(hits, /\[@webjsdev\/core\/src\/dir\/util\.js:1\]/, 'hit is tagged with pkg + rel path + line');
  assert.match(await grepSources(fakeTree(), 'zzzznotfound'), /No matches/);
  assert.match(await grepSources(fakeTree(), ''), /non-empty/);
});

test('grepSources: discloses the cap at > 60 matches (no silent truncation)', async () => {
  const many = Array.from({ length: 70 }, (_, i) => `hit signal ${i}`).join('\n');
  const out = await grepSources(fakeTree({ '/fw/core/src/big.js': many }), 'hit signal');
  const lines = out.split('\n');
  assert.equal(lines.length, 61, '60 hits + the disclosure line');
  assert.match(out, /truncated at 60 matches/);
});

test('readSource: reads a file; refuses traversal; rejects unknown package', async () => {
  const t = fakeTree();
  assert.match(await readSource(t, 'core/src/html.js'), /export const html/);
  assert.match(await readSource(t, '@webjsdev/server/src/ssr.js'), /renderToString/, 'accepts the @webjsdev/ prefix');
  // Counterfactual: a traversal path must be refused, not read.
  assert.match(await readSource(t, 'core/../../etc/passwd'), /Refusing to read outside/);
  assert.match(await readSource(t, 'core/../server/src/ssr.js'), /Refusing to read outside/, 'cannot hop packages via ..');
  assert.match(await readSource(t, 'nope/src/x.js'), /Unknown or unresolvable/);
});

test('runSourceTool: dispatches path -> read, query -> grep, none -> list', async () => {
  const t = fakeTree();
  assert.match(await runSourceTool(t, { path: 'core/src/html.js' }), /export const html/);
  assert.match(await runSourceTool(t, { query: 'renderToString' }), /server\/src\/ssr\.js/);
  assert.match(await runSourceTool(t, {}), /@webjsdev\/core\/src:/);
  assert.match(await runSourceTool(t, { package: 'cli' }), /@webjsdev\/cli\/lib:/);
});

test('resolveFrameworkRoots: finds every @webjsdev/* package in the monorepo', () => {
  const roots = resolveFrameworkRoots(REPO, { exists: existsSync });
  const names = roots.map((r) => r.pkg).sort();
  assert.deepEqual(names, ['cli', 'core', 'server', 'ts-plugin', 'ui'], 'all five resolve (cli is bin-only, ui/server hide package.json from exports)');
  // cli source dir is lib/, the rest src/.
  assert.match(roots.find((r) => r.pkg === 'cli').src, /\/lib$/);
  assert.match(roots.find((r) => r.pkg === 'server').src, /\/src$/);
});

test('resolveFrameworkRoots: fail-soft when nothing resolves', () => {
  // A cwd with no @webjsdev/* on any search path yields an empty list, not a throw.
  const roots = resolveFrameworkRoots('/nonexistent-xyz', { exists: () => false });
  assert.deepEqual(roots, []);
});
