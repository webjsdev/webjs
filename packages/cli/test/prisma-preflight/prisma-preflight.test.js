/**
 * Unit tests for the `webjs dev` Prisma-client preflight (#452).
 *
 * A bare `webjs dev` skips the npm `predev` hook (`prisma generate`), so a
 * Prisma app boots against an ungenerated client and crashes with no hint. The
 * preflight turns that into an actionable warning. The two assertions that
 * matter: it FIRES for a Prisma app with no generated client, and it stays
 * SILENT for a non-Prisma app (the counterfactual that proves it is scoped and
 * does not nag every app).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { usesPrisma, prismaClientState, prismaDevHint } from '../../lib/prisma-preflight.js';

/** Build a throwaway app dir from a {relpath: contents} map. */
function makeApp(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-prisma-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    writeFileSync(abs, body);
  }
  return dir;
}

const SCHEMA = 'generator client {\n  provider = "prisma-client-js"\n}\n';
const PKG_WITH_PRISMA = JSON.stringify({ dependencies: { '@prisma/client': '^6.0.0' } });
const PKG_NO_PRISMA = JSON.stringify({ dependencies: { '@webjsdev/core': '*' } });

test('usesPrisma: true when a schema is present', () => {
  const dir = makeApp({ 'prisma/schema.prisma': SCHEMA, 'package.json': PKG_NO_PRISMA });
  assert.equal(usesPrisma(dir), true);
  rmSync(dir, { recursive: true, force: true });
});

test('usesPrisma: true when @prisma/client is a dependency (no schema)', () => {
  const dir = makeApp({ 'package.json': PKG_WITH_PRISMA });
  assert.equal(usesPrisma(dir), true);
  rmSync(dir, { recursive: true, force: true });
});

test('usesPrisma: false for a non-Prisma app (the guard)', () => {
  const dir = makeApp({ 'package.json': PKG_NO_PRISMA });
  assert.equal(usesPrisma(dir), false);
  rmSync(dir, { recursive: true, force: true });
});

test('prismaDevHint: fires for a Prisma app with NO generated client', () => {
  const dir = makeApp({ 'prisma/schema.prisma': SCHEMA, 'package.json': PKG_WITH_PRISMA });
  assert.equal(prismaClientState(dir).status, 'missing');
  const hint = prismaDevHint(dir);
  assert.ok(hint, 'expected a hint');
  // The hint must name the canonical command and the escape hatch.
  assert.match(hint, /npm run dev/);
  assert.match(hint, /webjs db generate/);
  assert.match(hint, /not generated/);
  rmSync(dir, { recursive: true, force: true });
});

test('prismaDevHint: COUNTERFACTUAL — silent for a non-Prisma app', () => {
  // No schema, no @prisma/client. The preflight must NOT warn, or it nags every
  // app. This is the negative case that proves the guard is real.
  const dir = makeApp({ 'package.json': PKG_NO_PRISMA });
  assert.equal(prismaDevHint(dir), null);
  rmSync(dir, { recursive: true, force: true });
});

test('prismaDevHint: silent when the client is generated and fresh', () => {
  const dir = makeApp({
    'prisma/schema.prisma': SCHEMA,
    'package.json': PKG_WITH_PRISMA,
    'node_modules/.prisma/client/index.js': 'module.exports = {};\n',
  });
  // Make the generated client NEWER than the schema so it is not flagged stale.
  const future = Date.now() / 1000 + 60;
  utimesSync(join(dir, 'node_modules/.prisma/client/index.js'), future, future);
  assert.equal(prismaClientState(dir).status, 'ok');
  assert.equal(prismaDevHint(dir), null);
  rmSync(dir, { recursive: true, force: true });
});

test('prismaDevHint: flags a STALE client (schema newer than the generated client)', () => {
  const dir = makeApp({
    'prisma/schema.prisma': SCHEMA,
    'package.json': PKG_WITH_PRISMA,
    'node_modules/.prisma/client/index.js': 'module.exports = {};\n',
  });
  // Generated client OLD, schema NEW: a stale client.
  const past = Date.now() / 1000 - 3600;
  utimesSync(join(dir, 'node_modules/.prisma/client/index.js'), past, past);
  assert.equal(prismaClientState(dir).status, 'stale');
  const hint = prismaDevHint(dir);
  assert.ok(hint);
  assert.match(hint, /stale/);
  assert.match(hint, /npm run dev/);
  rmSync(dir, { recursive: true, force: true });
});

test('prismaClientState: treats the ungenerated @prisma/client placeholder as missing', () => {
  // Before `prisma generate`, @prisma/client ships a default.js whose body
  // references the init error. No .prisma/client output dir exists yet.
  const dir = makeApp({
    'prisma/schema.prisma': SCHEMA,
    'package.json': PKG_WITH_PRISMA,
    'node_modules/@prisma/client/default.js':
      'throw new Error("@prisma/client did not initialize yet. Please run `prisma generate`");\n',
  });
  assert.equal(prismaClientState(dir).status, 'missing');
  rmSync(dir, { recursive: true, force: true });
});
