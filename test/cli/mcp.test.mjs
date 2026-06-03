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
const REPO = resolve(__dirname, '..', '..');
const { runMcpServer, extractExportNames, extractRouteMethods } = await import(
  resolve(REPO, 'packages', 'cli', 'lib', 'mcp.js')
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
  assert.deepEqual(r.result.capabilities, { tools: {} });
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

test('mcp: tools/list returns the four tools with inputSchemas', async () => {
  const dir = tmpDir();
  const { frames } = await driveMcp(dir, [
    { jsonrpc: '2.0', id: 3, method: 'tools/list' },
  ]);
  const tools = frames[0].result.tools;
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['check', 'list_actions', 'list_components', 'list_routes']);
  for (const t of tools) {
    assert.equal(typeof t.description, 'string');
    assert.equal(t.inputSchema.type, 'object');
    assert.ok(t.inputSchema.properties.appDir, 'inputSchema declares appDir');
  }
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
