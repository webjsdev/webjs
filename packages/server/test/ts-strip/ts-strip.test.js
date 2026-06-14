/**
 * The pluggable TypeScript stripper seam (#508). Node uses the built-in
 * `module.stripTypeScriptTypes`; Bun (and any runtime without it) uses `amaro`.
 * These tests run under Node, so they exercise the built-in by default AND the
 * amaro backend via the `WEBJS_TS_STRIPPER=amaro` override, asserting the two are
 * byte-identical (which is why the Bun path is safe: amaro is exactly what Node's
 * built-in wraps).
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { stripTypeScript, ensureStripper, stripperName, __resetStripper } from '../../src/ts-strip.js';

const SAMPLES = [
  'const x: number = 5;\nexport const y = (z: { a: number }): number => z.a;\n',
  'import type { Foo } from "./foo.ts";\nexport function f<T>(a: T): T { return a; }\n',
  'class C { declare x: number; constructor() { this.x = 1; } m(s: string): void {} }\n',
  'export type T = { a: number };\nexport const v: T = { a: 1 };\n',
];

afterEach(() => {
  delete process.env.WEBJS_TS_STRIPPER;
  __resetStripper();
});

test('default backend on Node is the built-in stripper', async () => {
  __resetStripper();
  const s = await ensureStripper();
  assert.equal(s.name, 'builtin');
  assert.equal(stripperName(), 'builtin');
});

test('the built-in backend strips erasable TypeScript', async () => {
  __resetStripper();
  const out = await stripTypeScript('const n: number = 1;\n');
  assert.equal(out, nodeModule.stripTypeScriptTypes('const n: number = 1;\n'));
  assert.ok(!out.includes(': number'));
});

test('WEBJS_TS_STRIPPER=amaro forces the amaro backend', async () => {
  process.env.WEBJS_TS_STRIPPER = 'amaro';
  __resetStripper();
  const s = await ensureStripper();
  assert.equal(s.name, 'amaro');
  assert.equal(stripperName(), 'amaro');
});

test('the amaro backend output is byte-identical to the Node built-in (so Bun is safe)', async () => {
  for (const src of SAMPLES) {
    const builtin = nodeModule.stripTypeScriptTypes(src);
    process.env.WEBJS_TS_STRIPPER = 'amaro';
    __resetStripper();
    const amaroOut = await stripTypeScript(src);
    assert.equal(amaroOut, builtin, `amaro and built-in must agree for:\n${src}`);
    delete process.env.WEBJS_TS_STRIPPER;
  }
});

test('the amaro backend is position-preserving (same line count)', async () => {
  process.env.WEBJS_TS_STRIPPER = 'amaro';
  __resetStripper();
  const src = 'const a: number = 1;\nfunction f(x: string): void {}\nexport const g = 2;\n';
  const out = await stripTypeScript(src);
  assert.equal(out.split('\n').length, src.split('\n').length);
});

test('WEBJS_TS_STRIPPER=builtin forces the built-in when present', async () => {
  process.env.WEBJS_TS_STRIPPER = 'builtin';
  __resetStripper();
  const s = await ensureStripper();
  assert.equal(s.name, 'builtin');
});

test('the resolved backend is memoized (resolves once)', async () => {
  __resetStripper();
  const a = await ensureStripper();
  const b = await ensureStripper();
  assert.equal(a, b, 'ensureStripper returns the same memoized backend');
});

test('stripperName is null before resolution', () => {
  __resetStripper();
  assert.equal(stripperName(), null);
});

/* ---------------- non-erasable error parity (#509) ---------------- */

// A non-erasable construct must fail strip on BOTH backends with the SAME error
// code, so the one downstream classifier (dev.js's tsResponse ts-strip frame +
// 500) fires identically on Node and Bun. Node's built-in throws
// `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`; amaro reports `UnsupportedSyntax`, which
// the seam normalizes to the same code. Found by the Bun test matrix: without
// the normalization the dev-error overlay never classified the failure on Bun.
const NON_ERASABLE = 'export enum Color { Red, Green }\n';

test('the amaro backend tags a non-erasable error with Node\'s code (#509)', async () => {
  process.env.WEBJS_TS_STRIPPER = 'amaro';
  __resetStripper();
  await assert.rejects(
    () => stripTypeScript(NON_ERASABLE),
    (err) => {
      assert.equal(err.code, 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX', 'amaro error normalized to the Node code');
      return true;
    },
  );
  delete process.env.WEBJS_TS_STRIPPER;
});

test('the built-in backend throws the same code for the same construct', async () => {
  process.env.WEBJS_TS_STRIPPER = 'builtin';
  __resetStripper();
  await assert.rejects(
    () => stripTypeScript(NON_ERASABLE),
    (err) => {
      assert.equal(err.code, 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX', 'built-in uses the Node code');
      return true;
    },
  );
  delete process.env.WEBJS_TS_STRIPPER;
});
