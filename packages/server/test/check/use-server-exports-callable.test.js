/**
 * webjs check: use-server-exports-callable (#464). A `.server.{js,ts}` file that
 * declares `'use server'` but exports no callable action registers nothing (the
 * registrar only registers FUNCTION exports), so the failure is a silent 404 at
 * the first call site. The rule flags it; it stays quiet (conservative) when a
 * callable might exist via a re-export or a factory-produced const.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkConventions } from '../../src/check.js';

function app(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-usrv-callable-'));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  }
  return dir;
}
const flagged = (vs) => vs.some((v) => v.rule === 'use-server-exports-callable');
const flaggedFile = (vs, f) => vs.some((v) => v.rule === 'use-server-exports-callable' && v.file.endsWith(f));
async function run(files) {
  const dir = app(files);
  try { return await checkConventions(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// --- flagged: the directive exposes nothing callable ---

test('flags a use-server file that exports only a literal const', async () => {
  assert.ok(flagged(await run({ 'a.server.ts': `'use server';\nexport const MAX = 5;\n` })));
});

test('flags a use-server file with no exports at all', async () => {
  assert.ok(flagged(await run({ 'a.server.ts': `'use server';\nconst internal = 1;\nconsole.log(internal);\n` })));
});

test('flags a configured file that has verb config but no action', async () => {
  // method/cache are config, not callable actions; one-action-per-file would NOT
  // catch this (it only fires on >1 action), so this rule is the safety net.
  assert.ok(flagged(await run({ 'a.server.ts': `'use server';\nexport const method = 'GET';\nexport const cache = 60;\n` })));
});

test('flags a use-server file exporting only a type', async () => {
  assert.ok(flagged(await run({ 'a.server.ts': `'use server';\nexport type Payload = { id: number };\n` })));
});

test('flags a config-only file whose config is an arrow (no action)', async () => {
  // `validate` is config, not an action; the registrar excludes reserved names,
  // so this file registers zero actions even though `validate` is a function.
  assert.ok(flagged(await run({ 'a.server.ts': `'use server';\nexport const method = 'GET';\nexport const validate = (i) => i;\n` })));
});

test('flags a config-only file whose tags config is a factory call (no action)', async () => {
  assert.ok(flagged(await run({ 'a.server.ts': `'use server';\nexport const tags = makeTags('user');\n` })));
});

// --- passes: a callable is exported ---

test('passes a function-declaration action', async () => {
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nexport async function getX(id) { return { id }; }\n` })), false);
});

test('passes an arrow-const action', async () => {
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nexport const getX = async (id) => ({ id });\n` })), false);
});

test('passes a default-export action', async () => {
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nexport default async function (id) { return id; }\n` })), false);
});

test('passes a void side-effect action (no return value)', async () => {
  // The rule asserts "exports a callable", NOT "returns a value": a void
  // side-effect or a redirect()-throwing action is a valid action.
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nexport async function logEvent(e) { globalThis.sink = e; }\n` })), false);
});

test('passes a configured file WITH an action', async () => {
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nexport const method = 'GET';\nexport async function getX(id) { return id; }\n` })), false);
});

// --- conservative: a callable MIGHT exist, do not flag (avoid false positives) ---

test('does NOT flag a re-export (it may re-export a function)', async () => {
  assert.equal(flagged(await run({
    'a.server.ts': `'use server';\nexport { getX } from './impl.ts';\n`,
    'impl.ts': `export async function getX(){ return 1; }\n`,
  })), false);
});

test('does NOT flag a factory-produced const action (export const get = wrap(fn))', async () => {
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nfunction wrap(f){ return f; }\nexport const getX = wrap(async () => 1);\n` })), false);
});

test('does NOT flag a local function surfaced via export { getX } (no from)', async () => {
  // The runtime registrar keeps any function-valued export regardless of syntax,
  // so `function getX(){}; export { getX }` is a working action and must not flag.
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nasync function getX(id) { return { id }; }\nexport { getX };\n` })), false);
});

test('does NOT flag a renamed local export (export { impl as getThing })', async () => {
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nasync function impl(id) { return id; }\nexport { impl as getThing };\n` })), false);
});

test('does NOT flag an imported function re-surfaced via export { x } (no from)', async () => {
  assert.equal(flagged(await run({
    'a.server.ts': `'use server';\nimport { realAction } from './impl.ts';\nexport { realAction };\n`,
    'impl.ts': `export async function realAction(){ return 1; }\n`,
  })), false);
});

test('does NOT flag a destructured export of a function (export const { x } = obj)', async () => {
  assert.equal(flagged(await run({ 'a.server.ts': `'use server';\nconst api = { getX: async () => 1 };\nexport const { getX } = api;\n` })), false);
});

// --- scoping: not this rule's job ---

test('does NOT double-flag a use-server file missing the .server extension', async () => {
  // That is the use-server-needs-extension rule's case; this rule only runs on
  // properly-marked .server.{js,ts} files.
  const vs = await run({ 'a.ts': `'use server';\nexport const MAX = 5;\n` });
  assert.equal(flaggedFile(vs, 'a.ts'), false, 'no use-server-exports-callable on a non-.server file');
  assert.ok(vs.some((v) => v.rule === 'use-server-needs-extension'), 'the extension rule handles it instead');
});

test('does NOT flag a server-only utility (.server with NO use-server directive)', async () => {
  // A `.server.ts` without the directive is a server-only util; it may export
  // anything (a singleton, a const). Not subject to this rule.
  assert.equal(flagged(await run({ 'db.server.ts': `export const prisma = { connect() {} };\n` })), false);
});
