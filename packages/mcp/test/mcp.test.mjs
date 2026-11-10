/**
 * Smoke tests for the read-only `webjs mcp` server (#262).
 *
 * `runMcpServer({ stdin, stdout, stderr, cwd })` is driven IN-PROCESS with
 * PassThrough streams for determinism (no spawned process). We assert the MCP
 * stdio handshake + the four tools:
 *   - `initialize` returns serverInfo + capabilities + protocolVersion.
 *   - `notifications/initialized` (a notification, no id) gets NO reply.
 *   - `tools/list` returns the four tools, each with an inputSchema.
 *   - `tools/call` for `check` returns a content array whose text parses to
 *     `{ violations, summary }`; for `list_routes` returns the route projection.
 *   - the server MUTATES NOTHING (read-only).
 *   - a MALFORMED line is answered with a JSON-RPC parse error and does NOT
 *     crash the loop (a following valid request still works).
 *   - stdout carries ONLY JSON-RPC frames (protocol purity).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..', '..');
const { runMcpServer, extractExportNames, extractRouteMethods, extractActionConfig, loadUiDeps, runUiTool } = await import(
  resolve(REPO, 'packages', 'mcp', 'src', 'mcp.js')
);

const cleanup = [];
after(() => { for (const d of cleanup) rmSync(d, { recursive: true, force: true }); });

function tmpDir() {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-'));
  cleanup.push(dir);
  return dir;
}
function write(dir, rel, content) {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** Recursively list every file path (relative) under a dir, sorted. */
function listFiles(dir, base = dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) listFiles(full, base, out);
    else out.push(resolve(full).slice(base.length));
  }
  return out.sort();
}

/**
 * Drive the MCP server with a list of request objects (one per line). Returns
 * the parsed response frames (in order) plus the raw stdout text.
 */
async function driveMcp(cwd, requests, { rawLines = [] } = {}) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();

  let outBuf = '';
  stdout.on('data', (c) => { outBuf += c.toString(); });

  const done = runMcpServer({ stdin, stdout, stderr, cwd, version: '9.9.9' });

  // Write each request as one newline-delimited JSON line, plus any raw lines.
  for (const line of rawLines) stdin.write(line + '\n');
  for (const req of requests) stdin.write(JSON.stringify(req) + '\n');
  stdin.end();

  await done;

  const frames = outBuf
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  return { frames, raw: outBuf };
}

test('mcp: initialize handshake returns serverInfo + capabilities', async () => {
  const dir = tmpDir();
  write(dir, 'app/page.ts', `export default function P() {}\n`);
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
  ]);
  assert.equal(frames.length, 1);
  const r = frames[0];
  assert.equal(r.id, 1);
  assert.equal(r.result.protocolVersion, '2024-11-05');
  assert.deepEqual(r.result.capabilities, { tools: {} }, 'tools only: no doc resources, no recipe prompts');
  assert.deepEqual(r.result.serverInfo, { name: 'webjs', version: '9.9.9' });
});

test('mcp: notifications/initialized gets NO response', async () => {
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ]);
  // Only the tools/list reply, the notification produced nothing.
  assert.equal(frames.length, 1);
  assert.equal(frames[0].id, 2);
});

test('mcp: tools/list returns the introspection + knowledge tools with inputSchemas', async () => {
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 3, method: 'tools/list' },
  ]);
  const tools = frames[0].result.tools;
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['check', 'init', 'list_actions', 'list_components', 'list_routes', 'source', 'ui']);
  for (const t of tools) {
    assert.equal(typeof t.description, 'string');
    assert.equal(t.inputSchema.type, 'object');
  }
  // The introspection tools take appDir, and so does init, which compares the
  // app's installed @webjsdev/mcp with the running server's.
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.ok(byName.list_routes.inputSchema.properties.appDir, 'introspection tool declares appDir');
  assert.deepEqual(Object.keys(byName.init.inputSchema.properties), ['appDir'], 'init takes only appDir');
  assert.ok(byName.source.inputSchema.properties.path && byName.source.inputSchema.properties.query, 'source takes path/query/package');
  assert.ok(byName.ui.inputSchema.properties.name, 'ui takes an optional component name');
});

test('mcp: tools/call check returns a content array parsing to { violations, summary }', async () => {
  const dir = tmpDir();
  // Trip a violation so the report is non-trivial.
  write(
    dir,
    'components/broken.ts',
    `import { WebComponent, html } from '@webjsdev/core';\n` +
    `export class Broken extends WebComponent { render() { return html\`<p>x</p>\`; } }\n`,
  );
  const before = listFiles(dir);
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'check', arguments: {} } },
  ]);
  const content = frames[0].result.content;
  assert.ok(Array.isArray(content));
  assert.equal(content[0].type, 'text');
  const report = JSON.parse(content[0].text);
  assert.ok(Array.isArray(report.violations));
  assert.ok(report.violations.length > 0);
  assert.equal(typeof report.summary.count, 'number');
  assert.equal(report.summary.count, report.violations.length);
  // Read-only: the tool did not write / delete anything.
  assert.deepEqual(listFiles(dir), before, 'check mutated nothing');
});

test('mcp: tools/call list_routes returns the route projection', async () => {
  const dir = tmpDir();
  write(dir, 'app/page.ts', `export default function P() {}\n`);
  write(dir, 'app/blog/[slug]/page.ts', `export default function B() {}\n`);
  write(dir, 'app/api/users/route.ts', `export async function GET() {}\nexport async function POST() {}\n`);
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_routes', arguments: {} } },
  ]);
  const out = JSON.parse(frames[0].result.content[0].text);
  const paths = out.pages.map((p) => p.path).sort();
  assert.ok(paths.includes('/'), 'root page present');
  assert.ok(paths.includes('/blog/[slug]'), 'dynamic page present');
  const dyn = out.pages.find((p) => p.path === '/blog/[slug]');
  assert.equal(dyn.dynamic, true);
  assert.deepEqual(dyn.params, ['slug']);
  // API route with its methods.
  const api = out.apis.find((a) => a.path === '/api/users');
  assert.ok(api, 'api route present');
  assert.deepEqual(api.methods.sort(), ['GET', 'POST']);
});

test('mcp: list_routes output equals the shared projectRoutes (no drift with the CLI)', async () => {
  // The MCP tool and `webjs routes --json` both project through
  // routes-report.js, so the tool output MUST equal projectRoutes over the same
  // app. This locks the shared-projector guarantee (#975): if the MCP tool ever
  // stops delegating to projectRoutes, this fails.
  const { projectRoutes } = await import(resolve(REPO, 'packages', 'mcp', 'src', 'routes-report.js'));
  const { buildRouteTable } = await import('@webjsdev/server');
  const { readFile } = await import('node:fs/promises');
  const dir = tmpDir();
  write(dir, 'app/page.ts', `export default function P() {}\n`);
  write(dir, 'app/blog/[slug]/page.ts', `export default function B() {}\n`);
  write(dir, 'app/api/users/route.ts', `export async function GET() {}\nexport async function POST() {}\n`);

  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_routes', arguments: {} } },
  ]);
  const toolOut = JSON.parse(frames[0].result.content[0].text);
  const expected = await projectRoutes(await buildRouteTable(dir), { appDir: dir, readFile, extractRouteMethods });
  assert.deepEqual(toolOut, expected);
});

test('mcp: tools/call list_actions reports file + fn + RPC endpoint', async () => {
  const dir = tmpDir();
  write(
    dir,
    'modules/posts/actions/create.server.ts',
    `'use server';\nexport async function createPost(input) { return { success: true }; }\n`,
  );
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'list_actions', arguments: {} } },
  ]);
  const actions = JSON.parse(frames[0].result.content[0].text);
  const a = actions.find((x) => x.fn === 'createPost');
  assert.ok(a, 'createPost action listed');
  assert.match(a.file, /create\.server\.ts$/);
  assert.match(a.endpoint, /^\/__webjs\/action\/[0-9a-f]+\/createPost$/);
});

test('mcp: tools/call list_components reports tag + file + className', async () => {
  const dir = tmpDir();
  write(
    dir,
    'components/my-thing.ts',
    `import { WebComponent, html } from '@webjsdev/core';\n` +
    `export class MyThing extends WebComponent { render() { return html\`<p>x</p>\`; } }\n` +
    `MyThing.register('my-thing');\n`,
  );
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_components', arguments: {} } },
  ]);
  const comps = JSON.parse(frames[0].result.content[0].text);
  const c = comps.find((x) => x.tag === 'my-thing');
  assert.ok(c, 'my-thing component listed');
  assert.equal(c.className, 'MyThing');
  assert.match(c.file, /my-thing\.ts$/);
});

test('mcp: list_components stays a cheap lexical inventory', async () => {
  // Growing a field that needs the module graph onto list_components would
  // silently turn a scan that loads no module and builds no graph into one
  // that does both.
  const dir = tmpDir();
  write(dir, 'components/my-thing.ts',
    `import { WebComponent, html } from '@webjsdev/core';\n` +
    `export class MyThing extends WebComponent { render() { return html\`<p>x</p>\`; } }\n` +
    `MyThing.register('my-thing');\n`);
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 21, method: 'tools/call', params: { name: 'list_components', arguments: {} } },
  ]);
  const comps = JSON.parse(frames[0].result.content[0].text);
  assert.deepEqual(Object.keys(comps[0]).sort(), ['className', 'file', 'tag']);
});

test('mcp: unknown method -> JSON-RPC -32601', async () => {
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 8, method: 'no/such/method' },
  ]);
  assert.equal(frames[0].error.code, -32601);
});

test('mcp: unknown tool -> JSON-RPC error', async () => {
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'nope', arguments: {} } },
  ]);
  assert.equal(frames[0].error.code, -32602);
});

test('mcp: a malformed line yields a parse error and does NOT crash the loop', async () => {
  const dir = tmpDir();
  write(dir, 'app/page.ts', `export default function P() {}\n`);
  // A junk line first, then a valid request: both must be answered.
  const { frames } = await driveMcp(
    dir,
    [{ jsonrpc: '2.0', id: 11, method: 'tools/list' }],
    { rawLines: ['this is not json {{{'] },
  );
  // First frame: parse error (id null). Second: the valid tools/list reply.
  const parseErr = frames.find((f) => f.error && f.error.code === -32700);
  assert.ok(parseErr, 'a -32700 parse error was emitted');
  const listReply = frames.find((f) => f.id === 11);
  assert.ok(listReply && listReply.result.tools, 'valid request still served after junk');
});

test('mcp: stdout carries only JSON-RPC frames (protocol purity)', async () => {
  const dir = tmpDir();
  write(dir, 'app/page.ts', `export default function P() {}\n`);
  const { raw } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 12, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 13, method: 'tools/list' },
  ]);
  for (const line of raw.split('\n').filter((l) => l.trim())) {
    const f = JSON.parse(line); // throws if any non-JSON leaked to stdout
    assert.equal(f.jsonrpc, '2.0');
  }
});

test('extractExportNames: recognises decl, default, and named exports', () => {
  const src = `
    export async function createPost() {}
    export const listPosts = async () => {};
    export function helper() {}
    export default function Page() {}
    const a = 1, b = 2;
    export { a, b as renamed };
  `;
  const names = extractExportNames(src);
  assert.ok(names.includes('createPost'));
  assert.ok(names.includes('listPosts'));
  assert.ok(names.includes('helper'));
  assert.ok(names.includes('default'));
  assert.ok(names.includes('a'));
  assert.ok(names.includes('renamed'), 'the EXPORTED name of an alias');
  assert.ok(!names.includes('b'), 'the local name of an alias is not the export');
});

test('extractRouteMethods: only exported HTTP method names', () => {
  const src = `export async function GET() {}\nexport async function POST() {}\nexport function helper() {}\n`;
  assert.deepEqual(extractRouteMethods(src).sort(), ['GET', 'POST']);
});

test('mcp: a falsy id (0) and a string id are echoed, not dropped', async () => {
  const dir = tmpDir();
  write(dir, 'app/page.ts', `export default function P() {}\n`);
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 0, method: 'tools/list' },
    { jsonrpc: '2.0', id: 'abc', method: 'tools/list' },
  ]);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].id, 0, 'a 0 id must be echoed (no falsy drop)');
  assert.equal(frames[1].id, 'abc', 'a string id must be echoed');
});

/* ---------------- source tool (#378): read the framework's own source ---------------- */

test('mcp: tools/call source reads/greps/lists the framework source (driven against the monorepo)', async () => {
  // Drive with cwd = the repo so @webjsdev/* resolves to the workspace packages.
  // no-args -> the feature catalogue (#1686)
  let { frames } = await driveMcp(REPO, [
    { jsonrpc: '2.0', id: 40, method: 'tools/call', params: { name: 'source', arguments: {} } },
  ]);
  let text = frames[0].result.content[0].text;
  assert.match(text, /^What WebJs provides, by need\./, 'returns the feature catalogue');
  assert.match(text, /^  Auth: createAuth, /m, 'one line per need');

  // package -> that package's source listing
  ({ frames } = await driveMcp(REPO, [
    { jsonrpc: '2.0', id: 40, method: 'tools/call', params: { name: 'source', arguments: { package: 'server' } } },
  ]));
  text = frames[0].result.content[0].text;
  assert.match(text, /@webjsdev\/server\/src:/, 'lists the server source dir');
  assert.match(text, /buildless|authored source/i, 'frames it as the real authored source');

  // path -> read a real source file
  ({ frames } = await driveMcp(REPO, [
    { jsonrpc: '2.0', id: 41, method: 'tools/call', params: { name: 'source', arguments: { path: 'server/src/check.js' } } },
  ]));
  text = frames[0].result.content[0].text;
  assert.ok(text.length > 200 && /export/.test(text), 'returns the real check.js source');

  // query -> grep with pkg-qualified hits
  ({ frames } = await driveMcp(REPO, [
    { jsonrpc: '2.0', id: 42, method: 'tools/call', params: { name: 'source', arguments: { query: 'renderToString' } } },
  ]));
  assert.match(frames[0].result.content[0].text, /\[@webjsdev\/[a-z-]+\/src\/[^\]]+:\d+\]/, 'grep hits carry pkg + file:line');

  // traversal is refused, not read
  ({ frames } = await driveMcp(REPO, [
    { jsonrpc: '2.0', id: 43, method: 'tools/call', params: { name: 'source', arguments: { path: 'server/../../../etc/passwd' } } },
  ]));
  assert.match(frames[0].result.content[0].text, /Refusing to read outside/, 'traversal guard holds end to end');

  // the built core browser bundle (dist/) is NOT readable; only authored src/
  ({ frames } = await driveMcp(REPO, [
    { jsonrpc: '2.0', id: 44, method: 'tools/call', params: { name: 'source', arguments: { path: 'core/dist/webjs-core-browser.js' } } },
  ]));
  assert.match(frames[0].result.content[0].text, /Refusing to read outside/, 'dist (built bundle) not exposed, only src');
});

/* ---------------- the ui tool (#983): kit inventory + drift-guard ---------------- */

test('mcp: tools/call ui returns the kit inventory and matches the shared extractor (drift-guard)', async () => {
  // The ui tool projects @webjsdev/ui/registry/extract, the SAME leaf webjsui
  // view renders. Assert the tool output IS that projection, so the CLI and MCP
  // cannot drift (the #979 shared-projector pattern applied to the kit).
  const { uiInventory, uiComponent } = await import('@webjsdev/ui/registry/extract');
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 60, method: 'tools/call', params: { name: 'ui', arguments: {} } },
    { jsonrpc: '2.0', id: 61, method: 'tools/call', params: { name: 'ui', arguments: { name: 'accordion' } } },
    { jsonrpc: '2.0', id: 62, method: 'tools/call', params: { name: 'ui', arguments: { name: 'not-a-component' } } },
  ]);

  const inv = JSON.parse(frames.find((f) => f.id === 60).result.content[0].text);
  assert.deepEqual(inv.inventory, uiInventory(), 'inventory matches the shared extractor');
  assert.ok(inv.inventory.some((c) => c.name === 'button' && c.tier === 1));
  assert.ok(inv.inventory.some((c) => c.name === 'dialog' && c.tier === 2));

  const acc = JSON.parse(frames.find((f) => f.id === 61).result.content[0].text);
  assert.deepEqual(acc, uiComponent('accordion'), 'per-component payload matches the shared extractor');
  assert.ok(acc.helpers.length >= 4, 'accordion helper signatures are projected');

  const err = frames.find((f) => f.id === 62);
  assert.ok(err.result.isError, 'an unknown component is a tool error, not a crash');
});

test('loadUiDeps: a failing import (version skew / missing subpath) degrades to throwing stubs, does not reject', async () => {
  // This drives the REAL guard: the importer rejects (as it would when the
  // ./registry/extract subpath is missing), and loadUiDeps must resolve to a
  // stub whose functions throw a clear error, NOT reject (which would sink the
  // whole server at bootstrap).
  const deps = await loadUiDeps(async () => { throw new Error('Cannot find package @webjsdev/ui'); });
  assert.equal(typeof deps.uiInventory, 'function');
  assert.throws(() => deps.uiInventory(), /@webjsdev\/ui is not available/);
  assert.throws(() => deps.uiComponent('button'), /@webjsdev\/ui is not available/);
  // The happy path passes the module's exports through unchanged.
  const ok = await loadUiDeps(async () => ({ uiInventory: () => 'INV', uiComponent: () => 'C' }));
  assert.equal(ok.uiInventory(), 'INV');
});

test('mcp: throwing ui deps degrade only the ui tool, the server stays up', async () => {
  // With the ui deps unavailable (stubs that throw, as loadUiDeps returns on a
  // skew), the ui tool must report an error while the rest of the server (here
  // list_routes) still answers. Complements the loadUiDeps guard test above.
  const dir = tmpDir();
  write(dir, 'app/page.ts', 'export default function P() {}\n');
  const throwing = () => { throw new Error('@webjsdev/ui is not available'); };
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let outBuf = '';
  stdout.on('data', (c) => { outBuf += c.toString(); });
  const done = runMcpServer({
    stdin, stdout, stderr, cwd: dir, version: '9.9.9',
    uiDeps: { uiInventory: throwing, uiComponent: throwing },
  });
  stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 70, method: 'tools/call', params: { name: 'ui', arguments: {} } }) + '\n');
  stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 71, method: 'tools/call', params: { name: 'list_routes', arguments: {} } }) + '\n');
  stdin.end();
  await done;
  const frames = outBuf.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  const uiFrame = frames.find((f) => f.id === 70);
  assert.ok(uiFrame.result.isError, 'the ui tool reports an error when the kit is unavailable');
  const routesFrame = frames.find((f) => f.id === 71);
  assert.ok(!routesFrame.result.isError, 'list_routes still works');
  assert.ok(Array.isArray(JSON.parse(routesFrame.result.content[0].text).pages), 'list_routes returns the route projection');
});

/* ---------------- init: the WebJs brief ---------------- */

const { BRIEF } = await import(resolve(REPO, 'packages', 'mcp', 'src', 'brief.js'));

test('mcp: tools/call init returns the brief and the tool map', async () => {
  const { frames } = await driveMcp(tmpDir(), [
    { jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'init', arguments: {} } },
  ]);
  const text = frames[0].result.content[0].text;
  assert.match(text, /read first/i);
  assert.ok(text.includes(BRIEF), 'carries the brief verbatim');
  assert.match(text, /`source`/, 'points at the source tool for exact contracts');
  assert.match(text, /`check`/, 'points at the check tool');
  assert.ok(!/Warning:/.test(text), 'no installed copy, nothing to warn about');
});

test('mcp: the docs tool, doc resources and recipe prompts are gone', async () => {
  const { frames } = await driveMcp(tmpDir(), [
    { jsonrpc: '2.0', id: 21, method: 'tools/call', params: { name: 'docs', arguments: { topic: 'components' } } },
    { jsonrpc: '2.0', id: 22, method: 'resources/list' },
    { jsonrpc: '2.0', id: 23, method: 'prompts/list' },
    { jsonrpc: '2.0', id: 24, method: 'tools/list' },
  ]);
  assert.equal(frames[0].error.code, -32602, 'docs is an unknown tool');
  assert.equal(frames[1].error.code, -32601, 'resources/list is not served');
  assert.equal(frames[2].error.code, -32601, 'prompts/list is not served');
  assert.ok(frames[3].result.tools, 'the loop kept serving after the errors');
});

/** An app dir with its own installed @webjsdev/mcp at `version`. */
function appWithMcp(version) {
  const dir = tmpDir();
  write(dir, join('node_modules', '@webjsdev', 'mcp', 'package.json'), JSON.stringify({ name: '@webjsdev/mcp', version }));
  return dir;
}

test('mcp: every app-scoped tool ADVERTISES appDir, so a conforming client can actually send one', async () => {
  const { frames } = await driveMcp(tmpDir(), [{ jsonrpc: '2.0', id: 87, method: 'tools/list' }]);
  const byName = Object.fromEntries(frames[0].result.tools.map((t) => [t.name, t]));
  for (const name of ['init', 'list_routes', 'list_actions', 'list_components', 'check']) {
    assert.ok(byName[name], `${name} is advertised`);
    assert.equal(typeof byName[name].inputSchema.properties.appDir, 'object', `${name} advertises appDir`);
    assert.equal(byName[name].inputSchema.properties.appDir.type, 'string', `${name}'s appDir is a string`);
  }
  // `ui` is kit-scoped and `source` resolves from the server cwd, so neither takes one.
  for (const name of ['ui', 'source']) {
    assert.ok(!byName[name].inputSchema.properties.appDir, `${name} is not app-scoped`);
  }
});

test('mcp: init warns when the app has a newer @webjsdev/mcp than the running server', async () => {
  // driveMcp pins the server at 9.9.9, so an app on 10.0.0 is the stale-server case.
  const newer = appWithMcp('10.0.0');
  const same = appWithMcp('9.9.9');
  const { frames } = await driveMcp(same, [
    { jsonrpc: '2.0', id: 84, method: 'tools/call', params: { name: 'init', arguments: { appDir: newer } } },
    { jsonrpc: '2.0', id: 85, method: 'tools/call', params: { name: 'init', arguments: {} } },
  ]);
  const stale = frames[0].result.content[0].text;
  assert.match(stale, /Warning: this MCP server is @webjsdev\/mcp@9\.9\.9, but this app has @webjsdev\/mcp@10\.0\.0, so the brief and the tools below may be stale\./);
  assert.match(stale, /npm i -g @webjsdev\/mcp@latest/, 'says how to fix the stale install');
  assert.ok(stale.includes(BRIEF), 'advisory, never a refusal: the brief still follows');
  assert.ok(!/Warning:/.test(frames[1].result.content[0].text), 'no appDir defaults to cwd, where versions are equal');
});

/* ---------- extractActionConfig unit tests (#488) ---------- */

test('extractActionConfig: GET action with cache + tags reports correct config', () => {
  const src = `
    'use server';
    export const method = 'GET';
    export const cache = 60;
    export const tags = (id) => [\`user:\${id}\`];
    export async function getUser(id) { return {}; }
  `;
  const cfg = extractActionConfig(src);
  assert.equal(cfg.method, 'GET');
  assert.equal(cfg.cache, '60');
  assert.equal(cfg.tags, true);
  assert.equal(cfg.invalidates, false);
  assert.equal(cfg.validate, false);
  assert.equal(cfg.middleware, false);
});

test('extractActionConfig: object cache value is captured across lines', () => {
  const src = `
    'use server';
    export const method = 'GET';
    export const cache = { maxAge: 300, swr: 60, public: true };
    export async function getPosts() { return []; }
  `;
  const cfg = extractActionConfig(src);
  assert.equal(cfg.method, 'GET');
  assert.ok(cfg.cache && cfg.cache.startsWith('{') && cfg.cache.endsWith('}'), 'object cache captured');
  assert.ok(cfg.cache.includes('maxAge'), 'object cache includes maxAge');
});

test('extractActionConfig: POST mutation with invalidates', () => {
  const src = `
    'use server';
    export const invalidates = (id) => [\`user:\${id}\`];
    export async function updateUser(input) { return { success: true }; }
  `;
  const cfg = extractActionConfig(src);
  assert.equal(cfg.method, 'POST');
  assert.equal(cfg.cache, null);
  assert.equal(cfg.tags, false);
  assert.equal(cfg.invalidates, true);
  assert.equal(cfg.validate, false);
  assert.equal(cfg.middleware, false);
});

test('extractActionConfig: plain legacy action has POST + all config flags false', () => {
  const src = `
    'use server';
    export async function createPost(input) { return { success: true }; }
  `;
  const cfg = extractActionConfig(src);
  assert.equal(cfg.method, 'POST');
  assert.equal(cfg.cache, null);
  assert.equal(cfg.tags, false);
  assert.equal(cfg.invalidates, false);
  assert.equal(cfg.validate, false);
  assert.equal(cfg.middleware, false);
});

test('extractActionConfig: validate + middleware flags', () => {
  const src = `
    'use server';
    export const validate = (input) => ({ success: true });
    export const middleware = [authMw, logMw];
    export async function doThing(input) { return { success: true }; }
  `;
  const cfg = extractActionConfig(src);
  assert.equal(cfg.validate, true);
  assert.equal(cfg.middleware, true);
});

test('extractActionConfig: unrecognized method falls back to POST', () => {
  const src = `
    'use server';
    export const method = 'OPTIONS';
    export async function doThing() {}
  `;
  const cfg = extractActionConfig(src);
  assert.equal(cfg.method, 'POST', 'unrecognized verb defaults to POST');
});

test('extractActionConfig: method with double-quote and uppercase matches', () => {
  const src = `
    'use server';
    export const method = "DELETE";
    export async function removeItem(id) {}
  `;
  const cfg = extractActionConfig(src);
  assert.equal(cfg.method, 'DELETE');
});

/* ---------- list_actions: config fields + config exports excluded (#488) ---------- */

test('mcp: list_actions GET action reports method/cache/tags and excludes config exports', async () => {
  const dir = tmpDir();
  write(
    dir,
    'modules/users/queries/get-user.server.ts',
    [
      `'use server';`,
      `export const method = 'GET';`,
      `export const cache = 60;`,
      `export const tags = (id) => [\`user:\${id}\`];`,
      `export async function getUser(id) { return {}; }`,
    ].join('\n') + '\n',
  );
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 50, method: 'tools/call', params: { name: 'list_actions', arguments: {} } },
  ]);
  const actions = JSON.parse(frames[0].result.content[0].text);

  // Only the callable function is listed; config exports are NOT actions.
  const fns = actions.map((a) => a.fn);
  assert.ok(fns.includes('getUser'), 'getUser is listed');
  assert.ok(!fns.includes('method'), 'method config export is NOT listed as an action');
  assert.ok(!fns.includes('cache'), 'cache config export is NOT listed as an action');
  assert.ok(!fns.includes('tags'), 'tags config export is NOT listed as an action');

  const a = actions.find((x) => x.fn === 'getUser');
  assert.ok(a, 'getUser action found');
  assert.equal(a.method, 'GET');
  assert.equal(a.cache, '60');
  assert.equal(a.tags, true);
  assert.equal(a.invalidates, false);
  assert.equal(a.validate, false);
  assert.equal(a.middleware, false);
  assert.match(a.endpoint, /^\/__webjs\/action\/[0-9a-f]+\/getUser$/);
});

test('mcp: list_actions POST mutation with invalidates reports correct config', async () => {
  const dir = tmpDir();
  write(
    dir,
    'modules/users/actions/update-user.server.ts',
    [
      `'use server';`,
      `export const invalidates = (id) => [\`user:\${id}\`];`,
      `export async function updateUser(input) { return { success: true }; }`,
    ].join('\n') + '\n',
  );
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 51, method: 'tools/call', params: { name: 'list_actions', arguments: {} } },
  ]);
  const actions = JSON.parse(frames[0].result.content[0].text);
  const a = actions.find((x) => x.fn === 'updateUser');
  assert.ok(a, 'updateUser action found');
  assert.equal(a.method, 'POST');
  assert.equal(a.cache, null);
  assert.equal(a.invalidates, true);

  // invalidates config export must NOT appear as a separate action.
  const fns = actions.map((x) => x.fn);
  assert.ok(!fns.includes('invalidates'), 'invalidates config export is NOT listed as an action');
});

test('mcp: list_actions legacy action (no config) reports POST and all config flags false/null', async () => {
  const dir = tmpDir();
  write(
    dir,
    'modules/posts/actions/create.server.ts',
    `'use server';\nexport async function createPost(input) { return { success: true }; }\n`,
  );
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 52, method: 'tools/call', params: { name: 'list_actions', arguments: {} } },
  ]);
  const actions = JSON.parse(frames[0].result.content[0].text);
  const a = actions.find((x) => x.fn === 'createPost');
  assert.ok(a, 'createPost action found');
  assert.equal(a.method, 'POST');
  assert.equal(a.cache, null);
  assert.equal(a.tags, false);
  assert.equal(a.invalidates, false);
  assert.equal(a.validate, false);
  assert.equal(a.middleware, false);
});

/* ---------- drift guard: MCP local copies match action-config.js ---------- */

test('drift guard: MCP RESERVED_CONFIG and RPC_VERBS match action-config.js exports', async () => {
  const actionConfigPath = resolve(REPO, 'packages', 'server', 'src', 'action-config.js');
  const { RESERVED_CONFIG: srcReserved, RPC_VERBS: srcVerbs } = await import(actionConfigPath);

  // Re-read the MCP source to extract the local set literals lexically.
  // The simplest approach: import the module and introspect via extractActionConfig
  // coverage. But the sets are module-private constants. Test via behavior: verify
  // that every entry in the authoritative sets is handled the same way by
  // extractActionConfig (config names are not listed as actions, verbs are recognized).

  // Verify all RPC_VERBS from action-config.js are recognized by extractActionConfig.
  for (const verb of srcVerbs) {
    const src = `'use server';\nexport const method = '${verb}';\nexport async function fn() {}\n`;
    const cfg = extractActionConfig(src);
    assert.equal(cfg.method, verb, `RPC verb ${verb} must be recognized by extractActionConfig`);
  }

  // Verify EVERY RESERVED_CONFIG name from action-config.js is excluded from the
  // callable-action list by the REAL list_actions runner. A reserved name added
  // to action-config.js but missing from the MCP's local set would surface here
  // as a wrongly-listed action (each reserved name is declared as a function-
  // valued const, the shape that would otherwise count as a callable action).
  const reservedDecls = [...srcReserved].map((name) =>
    name === 'middleware' ? `export const ${name} = [];` : `export const ${name} = () => [];`,
  ).join('\n');
  // First confirm the lexical extractor SEES them all (so the filter is the gate,
  // not a parse miss), then confirm the runner excludes them.
  const probe = `'use server';\n${reservedDecls}\nexport async function myAction() {}\n`;
  const names = extractExportNames(probe);
  for (const name of srcReserved) {
    assert.ok(names.includes(name), `reserved name '${name}' must be visible to extractExportNames`);
  }
  const dir = tmpDir();
  write(dir, 'modules/x/cfg.server.ts', probe);
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 77, method: 'tools/call', params: { name: 'list_actions', arguments: {} } },
  ]);
  const listed = JSON.parse(frames[0].result.content[0].text).map((a) => a.fn);
  assert.deepEqual(listed, ['myAction'], 'only the callable action is listed; every reserved config name is excluded');
  for (const name of srcReserved) {
    assert.ok(!listed.includes(name), `reserved name '${name}' must be excluded from the action list (MCP RESERVED_CONFIG drift)`);
  }
});

test('mcp: a request split across stdin chunks (mid-line) still parses', async () => {
  const dir = tmpDir();
  write(dir, 'app/page.ts', `export default function P() {}\n`);
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = '';
  stdout.on('data', (c) => { out += c.toString(); });
  const done = runMcpServer({ stdin, stdout, stderr, cwd: dir, version: '9.9.9' });
  // Write a single JSON-RPC request in TWO chunks split mid-line. A line-based
  // reader must buffer until the newline rather than parsing each chunk.
  stdin.write('{"jsonrpc":"2.0","id":7,"method":"too');
  await new Promise((r) => setTimeout(r, 10));
  stdin.write('ls/list"}\n');
  stdin.end();
  await done;
  const frames = out.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  assert.equal(frames.length, 1);
  assert.equal(frames[0].id, 7, 'the chunk-split request parsed once the full line arrived');
  assert.ok(frames[0].result.tools, 'and dispatched correctly');
});

/* ---------------- the ui tool and blocks (#1666, D18) ---------------- */

// The no-argument `ui` call is what an agent makes first, every session, so
// its size is a running cost. Measured as the server sends it (pretty
// printed): about 16 KB with 62 components and the ten authentication
// blocks. The cap leaves room for the chart and sidebar blocks, whose NAMES
// are all the bare call carries; a later addition that has to cross it should
// make the payload more compact rather than raise the number.
const UI_NO_ARG_BYTE_CAP = 20_000;

test('mcp: ui with no args lists the blocks by category as names only, under a byte cap', async () => {
  const { uiBlockIndex } = await import('@webjsdev/ui/registry/extract');
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 80, method: 'tools/call', params: { name: 'ui', arguments: {} } },
  ]);
  const text = frames.find((f) => f.id === 80).result.content[0].text;
  const payload = JSON.parse(text);
  assert.deepEqual({ blocks: payload.blocks, charts: payload.charts }, uiBlockIndex(), 'matches the shared projector');
  assert.deepEqual(payload.blocks.login, ['login-01', 'login-02', 'login-03', 'login-04', 'login-05']);
  assert.deepEqual(payload.blocks.signup, ['signup-01', 'signup-02', 'signup-03', 'signup-04', 'signup-05']);
  for (const group of [payload.blocks, payload.charts]) {
    for (const names of Object.values(group)) assert.ok(names.every((n) => typeof n === 'string'), 'names only, no descriptions');
  }
  const bytes = Buffer.byteLength(text, 'utf8');
  assert.ok(bytes < UI_NO_ARG_BYTE_CAP, `the no-arg ui payload is ${bytes} bytes, over the ${UI_NO_ARG_BYTE_CAP} cap`);
});

test('mcp: ui type / category filters list blocks with their one-line descriptions', async () => {
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 81, method: 'tools/call', params: { name: 'ui', arguments: { type: 'block' } } },
    { jsonrpc: '2.0', id: 82, method: 'tools/call', params: { name: 'ui', arguments: { category: 'signup' } } },
  ]);
  const byType = JSON.parse(frames.find((f) => f.id === 81).result.content[0].text);
  assert.ok(byType.items.length >= 10);
  assert.ok(byType.items.every((i) => i.type === 'block' && i.description));
  const byCategory = JSON.parse(frames.find((f) => f.id === 82).result.content[0].text);
  assert.deepEqual(byCategory.items.map((i) => i.name), ['signup-01', 'signup-02', 'signup-03', 'signup-04', 'signup-05']);
});

test('mcp: ui with a block name returns the install command and file targets, and no cn-* name', async () => {
  const { uiBlock } = await import('@webjsdev/ui/registry/extract');
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 83, method: 'tools/call', params: { name: 'ui', arguments: { name: 'login-03' } } },
    { jsonrpc: '2.0', id: 84, method: 'tools/call', params: { name: 'ui', arguments: { name: 'login-03', source: true } } },
    { jsonrpc: '2.0', id: 85, method: 'tools/call', params: { name: 'ui', arguments: { name: 'card' } } },
  ]);
  const text = frames.find((f) => f.id === 83).result.content[0].text;
  const block = JSON.parse(text);
  assert.deepEqual(block, uiBlock('login-03'), 'matches the shared projector');
  assert.equal(block.install, 'npx @webjsdev/ui add login-03');
  assert.deepEqual(block.files.map((f) => f.target), ['app/login/page.ts', 'components/login-form.ts']);
  assert.ok(block.files.every((f) => f.content === undefined), 'no sources by default');

  const withSource = frames.find((f) => f.id === 84).result.content[0].text;
  assert.match(withSource, /export function loginForm/, 'source: true includes them');
  // Everything an agent copies from must be baked plain Tailwind (D8).
  const component = frames.find((f) => f.id === 85).result.content[0].text;
  for (const out of [text, withSource, component]) {
    assert.doesNotMatch(out, /(["'\s])cn-[a-z]/, 'no cn-* name in the ui tool output');
  }
});

test('runUiTool: an unknown name names both components and blocks', () => {
  const none = () => null;
  assert.throws(
    () => runUiTool({ uiInventory: none, uiComponent: none, uiBlocks: none, uiBlockIndex: none, uiBlock: none }, { name: 'nope' }),
    /Unknown component or block "nope"/,
  );
  assert.throws(
    () => runUiTool({ uiInventory: none, uiComponent: none, uiBlocks: () => [], uiBlockIndex: none, uiBlock: none }, { type: 'blocks' }),
    /Unknown type "blocks"/,
    'a misspelt type is an error, not an empty list',
  );
});

test('loadUiDeps: a @webjsdev/ui that predates blocks still serves components, the block deps answer empty', async () => {
  const old = await loadUiDeps(async () => ({ uiInventory: () => [], uiComponent: () => null }));
  assert.deepEqual(old.uiBlocks(), []);
  assert.deepEqual(old.uiBlockIndex(), { blocks: {}, charts: {} });
  assert.equal(old.uiBlock('login-01'), null);
  const gone = await loadUiDeps(async () => { throw new Error('missing'); });
  assert.throws(() => gone.uiBlock('login-01'), /@webjsdev\/ui is not available/);
  assert.throws(() => gone.uiBlockIndex(), /@webjsdev\/ui is not available/);
});
