/**
 * Tests for `webjs routes` (#975): the route-table printer.
 *
 * Two layers:
 *   - The PURE projector `projectRoutes(table, deps)` (the shared
 *     `@webjsdev/mcp/routes-report` module) against a tmp fixture app, so the
 *     `{ pages, apis }` shape is asserted without spawning anything.
 *   - The CLI integration: spawn `webjs routes` and assert the tree / --table /
 *     --json variants. The --json branch MUST be byte-identical to what the
 *     projector produces (the same projector backs the MCP `list_routes` tool),
 *     which is the whole point of the shared module.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const CLI = resolve(REPO, 'packages', 'cli', 'bin', 'webjs.js');

const { projectRoutes } = await import(
  resolve(REPO, 'packages', 'mcp', 'src', 'routes-report.js')
);
const { buildRouteTable } = await import('@webjsdev/server');
const { extractRouteMethods } = await import(
  resolve(REPO, 'packages', 'mcp', 'src', 'mcp.js')
);

const cleanup = [];
after(() => { for (const d of cleanup) rmSync(d, { recursive: true, force: true }); });

/** A fresh tmp fixture dir. */
function tmpDir() {
  const dir = mkdtempSync(join(tmpdir(), 'routes-'));
  cleanup.push(dir);
  return dir;
}

/** Write a file, creating parent dirs. */
function write(dir, rel, content) {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** A fixture app with a static page, a dynamic page, and an API route. */
function fixtureApp() {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({ name: 'fx' }));
  write(dir, 'app/page.ts', 'export default function P(){}\n');
  write(dir, 'app/blog/[slug]/page.ts', 'export default function B(){}\n');
  write(dir, 'app/api/users/route.ts', 'export async function GET(){}\nexport async function POST(){}\n');
  return dir;
}

function runCli(cwd, args) {
  return spawnSync(process.execPath, [CLI, 'routes', ...args], { cwd, encoding: 'utf8' });
}

// ---------------------------------------------------------------------------
// The pure projector.
// ---------------------------------------------------------------------------
test('projectRoutes returns pages (path/file/dynamic/params) and apis (path/file/methods)', async () => {
  const dir = fixtureApp();
  const table = await buildRouteTable(dir);
  const report = await projectRoutes(table, { appDir: dir, readFile, extractRouteMethods });

  const paths = report.pages.map((p) => p.path).sort();
  assert.ok(paths.includes('/'), 'root page present');
  assert.ok(paths.includes('/blog/[slug]'), 'dynamic page present');

  const root = report.pages.find((p) => p.path === '/');
  assert.equal(root.file, 'app/page.ts');
  assert.equal(root.dynamic, undefined, 'a static page carries no dynamic flag');

  const dyn = report.pages.find((p) => p.path === '/blog/[slug]');
  assert.equal(dyn.dynamic, true);
  assert.deepEqual(dyn.params, ['slug']);

  const api = report.apis.find((a) => a.path === '/api/users');
  assert.ok(api, 'api route present');
  assert.equal(api.file, 'app/api/users/route.ts');
  assert.deepEqual(api.methods.sort(), ['GET', 'POST']);
});

test('projectRoutes tolerates an unreadable route file (empty methods, no throw)', async () => {
  const dir = fixtureApp();
  const table = await buildRouteTable(dir);
  // A readFile that always throws simulates a race-deleted / permission-denied
  // route file; the api should still appear, with an empty method list.
  const report = await projectRoutes(table, {
    appDir: dir,
    readFile: async () => { throw new Error('ENOENT'); },
    extractRouteMethods,
  });
  const api = report.apis.find((a) => a.path === '/api/users');
  assert.ok(api, 'api still listed');
  assert.deepEqual(api.methods, [], 'unreadable route degrades to no methods');
});

// ---------------------------------------------------------------------------
// CLI integration.
// ---------------------------------------------------------------------------
test('webjs routes --json is byte-identical to the shared projector', async () => {
  const dir = fixtureApp();
  const table = await buildRouteTable(dir);
  const expected = await projectRoutes(table, { appDir: dir, readFile, extractRouteMethods });

  const r = runCli(dir, ['--json']);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stderr}`);
  assert.deepEqual(JSON.parse(r.stdout), expected);
  // And the serialized form matches too (the CLI stringifies the projector output verbatim).
  assert.equal(r.stdout.trim(), JSON.stringify(expected));
});

test('webjs routes (tree) lists pages and API routes with methods', () => {
  const dir = fixtureApp();
  const r = runCli(dir, []);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /2 page\(s\), 1 API route\(s\)/);
  assert.match(r.stdout, /\/blog\/\[slug\]/);
  assert.match(r.stdout, /app\/page\.ts/);
  assert.match(r.stdout, /\/api\/users/);
  assert.match(r.stdout, /GET, POST/);
});

test('webjs routes --table prints aligned KIND/PATH/METHODS/FILE columns', () => {
  const dir = fixtureApp();
  const r = runCli(dir, ['--table']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^KIND\s+PATH\s+METHODS\s+FILE/m);
  assert.match(r.stdout, /^page\s+\/\s+GET\s+app\/page\.ts/m);
  assert.match(r.stdout, /^api\s+\/api\/users\s+GET, POST\s+app\/api\/users\/route\.ts/m);
});

test('webjs routes on an app with no routes says so', () => {
  const dir = tmpDir();
  write(dir, 'package.json', JSON.stringify({ name: 'empty' }));
  const r = runCli(dir, []);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /0 page\(s\), 0 API route\(s\)/);
  assert.match(r.stdout, /No routes found/);
});
