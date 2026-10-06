// Unit tests for `webjs audit` (#1492): the fail-closed config reader, the
// npm + bun report parsers, and the allowlist filter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readAuditConfig, detectAuditManager, parseAuditReport, applyAuditConfig,
} from '../../lib/audit.js';

const BRACES = 'GHSA-vfj7-8cjw-p6xm';

test('no webjs.audit means level high and nothing ignored', () => {
  assert.deepEqual(readAuditConfig({}), { config: { level: 'high', ignore: [] }, errors: [] });
});

test('a valid block is read as declared', () => {
  const { config, errors } = readAuditConfig({ webjs: { audit: { level: 'critical', ignore: [{ id: BRACES, reason: 'dev tooling only' }] } } });
  assert.deepEqual(errors, []);
  assert.equal(config.level, 'critical');
  assert.deepEqual(config.ignore, [{ id: BRACES, reason: 'dev tooling only' }]);
});

test('the reader fails closed on every malformed shape', () => {
  const errs = (audit) => readAuditConfig({ webjs: { audit } }).errors;
  assert.match(errs('high')[0], /must be an object/);
  assert.match(errs({ levle: 'high' })[0], /unknown key "levle"/);
  assert.match(errs({ level: 'severe' })[0], /level must be one of/);
  assert.match(errs({ ignore: BRACES })[0], /must be an array/);
  assert.match(errs({ ignore: [{ id: BRACES }] })[0], /needs a non-empty "reason"/);
  assert.match(errs({ ignore: [{ id: BRACES, reason: '  ' }] })[0], /needs a non-empty "reason"/);
  assert.match(errs({ ignore: [{ id: 'braces', reason: 'x' }] })[0], /must be an advisory id/);
  assert.match(errs({ ignore: [{ id: BRACES, reason: 'x', why: 'y' }] })[0], /unknown key "why"/);
  // A CVE id is accepted too.
  assert.deepEqual(errs({ ignore: [{ id: 'CVE-2024-4068', reason: 'x' }] }), []);
});

test('detectAuditManager walks up to the nearest lockfile (a workspace root)', () => {
  const root = mkdtempSync(join(tmpdir(), 'webjs-audit-pm-'));
  try {
    const app = join(root, 'apps', 'web');
    mkdirSync(app, { recursive: true });
    writeFileSync(join(root, 'bun.lock'), '');
    assert.equal(detectAuditManager(app), 'bun');
    writeFileSync(join(app, 'package-lock.json'), '{}');
    assert.equal(detectAuditManager(app), 'npm', 'the nearest lockfile wins');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

const NPM_REPORT = {
  auditReportVersion: 2,
  vulnerabilities: {
    braces: { name: 'braces', severity: 'high', via: [{ source: 1, url: `https://github.com/advisories/${BRACES}`, severity: 'high', title: 'braces DoS' }] },
    micromatch: { name: 'micromatch', severity: 'high', via: ['braces'] },
    'basic-ftp': { name: 'basic-ftp', severity: 'high', via: [{ source: 2, url: 'https://github.com/advisories/GHSA-c475-qrg2-pj4r', severity: 'high', title: 'ftp' }] },
    lodash: { name: 'lodash', severity: 'moderate', via: [{ source: 3, url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'moderate', title: 'proto' }] },
  },
};
const BUN_REPORT = {
  braces: [{ id: 1, url: `https://github.com/advisories/${BRACES}`, title: 'braces DoS', severity: 'high' }],
};

test('npm report: source advisories only, a dependent-only entry is not one', () => {
  const adv = parseAuditReport('npm', JSON.stringify(NPM_REPORT));
  assert.deepEqual(adv.map((a) => a.id).sort(), ['GHSA-aaaa-bbbb-cccc', 'GHSA-c475-qrg2-pj4r', BRACES].sort());
});

test('bun report parses to the same advisory shape', () => {
  assert.deepEqual(parseAuditReport('bun', JSON.stringify(BUN_REPORT)), [
    { id: BRACES, url: `https://github.com/advisories/${BRACES}`, severity: 'high', title: 'braces DoS', packages: ['braces'] },
  ]);
});

test('an unparseable or error report is null (the caller fails closed)', () => {
  assert.equal(parseAuditReport('npm', 'npm ERR! network'), null);
  assert.equal(parseAuditReport('npm', JSON.stringify({ error: { code: 'ENOLOCK' } })), null);
});

test('applyAuditConfig: ignores listed ids, keeps the rest at level, flags stale ids', () => {
  const adv = parseAuditReport('npm', JSON.stringify(NPM_REPORT));
  const config = { level: 'high', ignore: [{ id: BRACES, reason: 'r' }, { id: 'GHSA-zzzz-zzzz-zzzz', reason: 'gone' }] };
  const { failing, ignored, stale } = applyAuditConfig(adv, config);
  assert.deepEqual(failing.map((a) => a.id), ['GHSA-c475-qrg2-pj4r'], 'basic-ftp still fails; the moderate one is below level');
  assert.deepEqual(ignored.map((a) => a.id), [BRACES]);
  assert.deepEqual(stale.map((i) => i.id), ['GHSA-zzzz-zzzz-zzzz']);
  // Counterfactual: with nothing ignored, braces fails too.
  assert.equal(applyAuditConfig(adv, { level: 'high', ignore: [] }).failing.length, 2);
});
