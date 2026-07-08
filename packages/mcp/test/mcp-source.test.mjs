/**
 * Unit tests for the `source` tool (#378): `mcp-source.js`. The grep/read/list
 * logic is driven with an INJECTED fake framework tree (no real fs), so it is
 * deterministic; `resolveFrameworkRoots` is additionally exercised against the
 * real monorepo (it must find every `@webjsdev/*` package) and a fail-soft path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..', '..');
const {
  resolveFrameworkRoots,
  walkSource,
  listSources,
  grepSources,
  readSource,
  runSourceTool,
} = await import(resolve(REPO, 'packages', 'mcp', 'src', 'mcp-source.js'));

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

test('grepSources: a cross-package symbol is found (server src, the actionData case #837)', async () => {
  const out = await grepSources(fakeTree(), 'renderToString');
  assert.match(out, /\[@webjsdev\/server\/src\/ssr\.js:1\]/, 'finds a symbol in the server package src');
});

test('grepSources: empty roots report NOTHING searched, not a false "no match" (#837)', async () => {
  // The dogfood failure: a shimmed/odd node_modules layout resolved zero roots,
  // so a real symbol looked missing. "No matches" must NOT be returned when the
  // search never ran; that reads as authoritative absence.
  const noRoots = { ...fakeTree(), roots: [] };
  const out = await grepSources(noRoots, 'renderToString');
  assert.doesNotMatch(out, /No matches for/, 'not a false "no match" when nothing was searched');
  assert.match(out, /nothing was searched/i, 'says nothing was searched');
});

test('grepSources: a genuine no-match discloses the searched packages (#837)', async () => {
  const out = await grepSources(fakeTree(), 'zzzznotfound');
  assert.match(out, /core, server, cli/, 'discloses the searched scope so absence is trustworthy');
});

test('grepSources: discloses the cap at > 60 matches (no silent truncation)', async () => {
  const many = Array.from({ length: 70 }, (_, i) => `hit signal ${i}`).join('\n');
  const out = await grepSources(fakeTree({ '/fw/core/src/big.js': many }), 'hit signal');
  const lines = out.split('\n');
  assert.equal(lines.length, 61, '60 hits + the disclosure line');
  assert.match(out, /truncated at 60 matches/);
});

test('readSource: reads authored src; refuses traversal, dist, and out-of-src files', async () => {
  const t = fakeTree({ '/fw/core/dist/webjs-core-browser.js': 'built bundle\n', '/fw/core/package.json': '{}' });
  assert.match(await readSource(t, 'core/src/html.js'), /export const html/);
  assert.match(await readSource(t, '@webjsdev/server/src/ssr.js'), /renderToString/, 'accepts the @webjsdev/ prefix');
  // Counterfactual: a traversal path must be refused, not read.
  assert.match(await readSource(t, 'core/../../etc/passwd'), /Refusing to read outside/);
  assert.match(await readSource(t, 'core/../server/src/ssr.js'), /Refusing to read outside/, 'cannot hop packages via ..');
  // Scoped to src/: the built dist bundle and package.json are NOT readable.
  assert.match(await readSource(t, 'core/dist/webjs-core-browser.js'), /Refusing to read outside/, 'dist (the built bundle) is not exposed');
  assert.match(await readSource(t, 'core/package.json'), /Refusing to read outside/, 'only the authored source dir is exposed');
  assert.match(await readSource(t, 'nope/src/x.js'), /Unknown or unresolvable/);
});

test('readSource: a symlink inside src that points outside is refused (realpath hardening)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'mcp-src-symlink-'));
  const src = join(root, 'pkg', 'src');
  const secret = join(root, 'secret.txt');
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, 'real.js'), 'export const ok = 1;\n');
  writeFileSync(secret, 'SECRET\n');
  let symlinked = true;
  try { symlinkSync(secret, join(src, 'evil.js')); } catch { symlinked = false; } // skip if symlinks unsupported
  const deps = {
    roots: [{ pkg: 'pkg', root: join(root, 'pkg'), src }],
    readFile: async (p) => (await import('node:fs/promises')).readFile(p, 'utf8'),
    realpath: realpathSync,
  };
  assert.match(await readSource(deps, 'pkg/src/real.js'), /export const ok/, 'a normal src file still reads');
  if (symlinked) {
    const out = await readSource(deps, 'pkg/src/evil.js');
    assert.match(out, /Refusing to read outside/, 'the escaping symlink is refused');
    assert.ok(!/SECRET/.test(out), 'the symlink target is never returned');
  }
  rmSync(root, { recursive: true, force: true });
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
  assert.deepEqual(names, ['cli', 'core', 'intellisense', 'server', 'ui'], 'all five resolve (cli is bin-only, ui/server hide package.json from exports)');
  // cli source dir is lib/, the rest src/.
  assert.match(roots.find((r) => r.pkg === 'cli').src, /\/lib$/);
  assert.match(roots.find((r) => r.pkg === 'server').src, /\/src$/);
});

test('resolveFrameworkRoots: fail-soft when nothing resolves', () => {
  // A cwd with no @webjsdev/* on any search path yields an empty list, not a throw.
  const roots = resolveFrameworkRoots('/nonexistent-xyz', { exists: () => false });
  assert.deepEqual(roots, []);
});
