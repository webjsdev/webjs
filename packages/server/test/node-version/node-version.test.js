/**
 * Unit tests for the Node-version preflight guard (issue #238): the pure
 * version comparison (passes on >= the minimum, FAILS the counterfactual older
 * version), the major / engines parsing, the message contents, and the
 * side-effecting assert in both `throw` and `exit` modes, all with injected
 * version strings so no old Node is spawned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  parseMajor,
  parseRequiredMajor,
  checkNodeVersion,
  requiredNodeMajor,
  assertNodeVersion,
} from '../../src/node-version.js';

/* ---------------- parseMajor ---------------- */

test('parseMajor reads the leading major integer', () => {
  assert.equal(parseMajor('24.1.0'), 24);
  assert.equal(parseMajor('v24.1.0'), 24);
  assert.equal(parseMajor('22.5.0'), 22);
  assert.equal(parseMajor('20.0.0'), 20);
  // Prerelease / nightly tags still parse to their major.
  assert.equal(parseMajor('24.0.0-nightly20240101abcdef'), 24);
  assert.equal(parseMajor('  24.3.1  '), 24);
});

test('parseMajor returns NaN for an unparseable string', () => {
  assert.ok(Number.isNaN(parseMajor('not-a-version')));
  assert.ok(Number.isNaN(parseMajor('')));
});

/* ---------------- parseRequiredMajor ---------------- */

test('parseRequiredMajor reads the major out of an engines range', () => {
  assert.equal(parseRequiredMajor('>=24.0.0'), 24);
  assert.equal(parseRequiredMajor('>= 24'), 24);
  assert.equal(parseRequiredMajor('24.x'), 24);
  assert.equal(parseRequiredMajor('^24.1.0'), 24);
});

test('parseRequiredMajor returns NaN when no integer is present', () => {
  assert.ok(Number.isNaN(parseRequiredMajor('*')));
  assert.ok(Number.isNaN(parseRequiredMajor('')));
});

/* ---------------- checkNodeVersion (pure) ---------------- */

test('checkNodeVersion passes on the minimum and above', () => {
  for (const v of ['24.0.0', '24.1.0', '25.0.0', 'v24.3.1', '30.2.0']) {
    const r = checkNodeVersion(v, 24);
    assert.equal(r.ok, true, `${v} should be ok`);
    assert.equal(r.message, '');
  }
});

test('checkNodeVersion COUNTERFACTUAL: an older Node fails the check', () => {
  // The negative case that must break when the guard is reverted.
  for (const v of ['22.0.0', '22.5.0', '20.0.0', '18.19.1', 'v23.9.0']) {
    const r = checkNodeVersion(v, 24);
    assert.equal(r.ok, false, `${v} should fail`);
    assert.notEqual(r.message, '');
  }
});

test('checkNodeVersion message names the found AND required version', () => {
  const r = checkNodeVersion('22.0.0', 24);
  assert.ok(r.message.includes('22.0.0'), 'message names the found version');
  assert.ok(r.message.includes('24'), 'message names the required major');
  assert.ok(/stripTypeScriptTypes/.test(r.message), 'message explains why (TS strip)');
  assert.ok(/fs\.watch/.test(r.message), 'message explains why (fs.watch)');
});

test('checkNodeVersion reports structured fields', () => {
  const r = checkNodeVersion('22.5.0', 24);
  assert.equal(r.current, '22.5.0');
  assert.equal(r.currentMajor, 22);
  assert.equal(r.requiredMajor, 24);
});

test('checkNodeVersion exact-boundary: required major itself passes', () => {
  assert.equal(checkNodeVersion('24.0.0-nightly', 24).ok, true);
  assert.equal(checkNodeVersion('23.999.999', 24).ok, false);
});

test('checkNodeVersion fails open on an unparseable running version', () => {
  // We do not block a runtime that reports an unusual version string.
  const r = checkNodeVersion('weird-runtime', 24);
  assert.equal(r.ok, true);
});

/* ---------------- requiredNodeMajor (DRY source) ---------------- */

test('requiredNodeMajor reads the package engines.node field', () => {
  const major = requiredNodeMajor();
  // Sourced from this package's own engines.node, no drift.
  const require = createRequire(import.meta.url);
  const pkg = require('../../package.json');
  const expected = Number(String(pkg.engines.node).match(/(\d+)/)[1]);
  assert.equal(major, expected);
  assert.equal(major, 24);
});

/* ---------------- assertNodeVersion (side-effecting) ---------------- */

test('assertNodeVersion is a no-op on a supported Node', () => {
  assert.doesNotThrow(() => assertNodeVersion({ current: '24.1.0', requiredMajor: 24 }));
  // And against the real running Node + real engines field (the test suite
  // itself runs on Node 24+, so this must not throw).
  assert.doesNotThrow(() => assertNodeVersion());
});

test('assertNodeVersion throws a clear Error on an old Node (throw mode)', () => {
  assert.throws(
    () => assertNodeVersion({ current: '22.0.0', requiredMajor: 24, onFail: 'throw' }),
    (err) => err instanceof Error && err.message.includes('22.0.0') && err.message.includes('24'),
  );
});

test('assertNodeVersion exits non-zero on an old Node (exit mode)', () => {
  // Stub process.exit + console.error so the test process is not killed.
  const origExit = process.exit;
  const origError = console.error;
  let exitCode = null;
  let logged = '';
  process.exit = (code) => { exitCode = code; throw new Error('__exit__'); };
  console.error = (msg) => { logged += String(msg); };
  try {
    assert.throws(
      () => assertNodeVersion({ current: '20.0.0', requiredMajor: 24, onFail: 'exit' }),
      /__exit__/,
    );
  } finally {
    process.exit = origExit;
    console.error = origError;
  }
  assert.equal(exitCode, 1);
  assert.ok(logged.includes('20.0.0'));
  assert.ok(logged.includes('24'));
});
