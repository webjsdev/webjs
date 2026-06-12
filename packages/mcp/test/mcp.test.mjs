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
const { runMcpServer, extractExportNames, extractRouteMethods } = await import(
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
  assert.deepEqual(r.result.capabilities, { tools: {}, resources: {}, prompts: {} });
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
  assert.deepEqual(names, ['check', 'docs', 'init', 'list_actions', 'list_components', 'list_routes', 'source']);
  for (const t of tools) {
    assert.equal(typeof t.description, 'string');
    assert.equal(t.inputSchema.type, 'object');
  }
  // The introspection tools take appDir; init takes nothing; docs takes topic/query.
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.ok(byName.list_routes.inputSchema.properties.appDir, 'introspection tool declares appDir');
  assert.deepEqual(byName.init.inputSchema.properties, {}, 'init takes no args');
  assert.ok(byName.docs.inputSchema.properties.topic && byName.docs.inputSchema.properties.query, 'docs takes topic/query');
  assert.ok(byName.source.inputSchema.properties.path && byName.source.inputSchema.properties.query, 'source takes path/query/package');
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
  // no-args -> the package listing
  let { frames } = await driveMcp(REPO, [
    { jsonrpc: '2.0', id: 40, method: 'tools/call', params: { name: 'source', arguments: {} } },
  ]);
  let text = frames[0].result.content[0].text;
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

/* ---------------- knowledge layer (#376): init / docs / resources / prompts ---------------- */

test('mcp: tools/call init returns the read-first primer (NOT-React mental model + invariants)', async () => {
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'init', arguments: {} } },
  ]);
  const text = frames[0].result.content[0].text;
  assert.equal(typeof text, 'string');
  assert.match(text, /read first/i);
  assert.match(text, /NO RSC/, 'steers away from the React/RSC mental model');
  assert.match(text, /Invariants/, 'includes the invariants section sourced from AGENTS.md');
  assert.match(text, /webjs-docs:\/\//, 'lists the doc resources');
});

test('mcp: tools/call docs returns a topic, a query search, and the index', async () => {
  const dir = tmpDir();
  // topic
  let { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 21, method: 'tools/call', params: { name: 'docs', arguments: { topic: 'recipes' } } },
  ]);
  assert.match(frames[0].result.content[0].text, /recipe|page|action|component/i, 'topic returns the recipes doc');
  // query
  ({ frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 22, method: 'tools/call', params: { name: 'docs', arguments: { query: 'signal' } } },
  ]));
  assert.match(frames[0].result.content[0].text, /webjs-docs:\/\//, 'query returns hits tagged with their source URI');
  // no args -> index
  ({ frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 23, method: 'tools/call', params: { name: 'docs', arguments: {} } },
  ]));
  assert.match(frames[0].result.content[0].text, /topics/i, 'no args returns the topic index');
  // unknown topic fails soft (no crash, a helpful message)
  ({ frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 24, method: 'tools/call', params: { name: 'docs', arguments: { topic: 'does-not-exist' } } },
  ]));
  assert.match(frames[0].result.content[0].text, /Unknown topic/, 'unknown topic returns a message, not an error frame');
});

test('mcp: resources/list + resources/read serve the framework docs; unknown uri errors cleanly', async () => {
  const dir = tmpDir();
  let { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 25, method: 'resources/list' },
  ]);
  const resources = frames[0].result.resources;
  assert.ok(Array.isArray(resources) && resources.length >= 5, 'a corpus of resources');
  assert.ok(resources.some((r) => r.uri === 'webjs-docs://AGENTS'), 'the AGENTS contract is a resource');
  assert.ok(resources.some((r) => r.uri === 'webjs-docs://components'), 'agent-docs are resources');
  for (const r of resources) assert.equal(r.mimeType, 'text/markdown');

  // read one
  ({ frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 26, method: 'resources/read', params: { uri: 'webjs-docs://components' } },
  ]));
  const contents = frames[0].result.contents;
  assert.equal(contents[0].uri, 'webjs-docs://components');
  assert.equal(contents[0].mimeType, 'text/markdown');
  assert.ok(contents[0].text.length > 100, 'returns the doc text');

  // unknown uri -> JSON-RPC error, loop survives
  ({ frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 27, method: 'resources/read', params: { uri: 'webjs-docs://nope' } },
    { jsonrpc: '2.0', id: 28, method: 'resources/list' },
  ]));
  assert.equal(frames[0].error.code, -32602, 'unknown resource is a -32602');
  assert.ok(frames[1].result.resources, 'the loop kept serving after the error');
});

test('mcp: prompts/list + prompts/get serve the recipe workflows; unknown prompt errors cleanly', async () => {
  const dir = tmpDir();
  let { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 29, method: 'prompts/list' },
  ]);
  const prompts = frames[0].result.prompts;
  const names = prompts.map((p) => p.name).sort();
  assert.deepEqual(names, ['add_component', 'add_dynamic_route', 'add_module', 'add_page', 'add_server_action', 'fetch_data_in_component']);

  // get one, with an argument folded in
  ({ frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 30, method: 'prompts/get', params: { name: 'add_component', arguments: { tag: 'my-thing' } } },
  ]));
  const got = frames[0].result;
  assert.equal(typeof got.description, 'string');
  assert.equal(got.messages[0].role, 'user');
  assert.match(got.messages[0].content.text, /my-thing/, 'the provided arg is folded in');
  assert.match(got.messages[0].content.text, /register|signal|WebComponent/, 'carries the component recipe');

  // unknown prompt -> error, loop survives
  ({ frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 31, method: 'prompts/get', params: { name: 'nope' } },
    { jsonrpc: '2.0', id: 32, method: 'prompts/list' },
  ]));
  assert.equal(frames[0].error.code, -32602, 'unknown prompt is a -32602');
  assert.ok(frames[1].result.prompts, 'the loop kept serving after the error');
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
