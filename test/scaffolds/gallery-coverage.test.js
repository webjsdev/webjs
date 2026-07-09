// Scaffold teaching-coverage gate (the tier-2, un-skippable enforcement).
//
// The `require-scaffold-with-src.sh` commit hook is only a FLOOR: it blocks a
// feature commit that stages NO scaffold surface, but it cannot tell a real
// demo from a doc bullet, so a new API can ship documented-but-undemoed (the
// #848 gap: forbidden()/unauthorized() got app-tree bullets, no gallery demo).
//
// This test is the missing tier-2: it runs on every `npm test` (and in CI),
// reconciles the LIVE @webjsdev/core export surface against the hand-curated
// test/scaffolds/gallery-coverage.json manifest, and FAILS when a new export is
// neither demoed nor exempted. So the moment someone adds a core export, CI is
// red until they either add a runnable gallery demo (a { demo } pointer) or
// consciously exempt it with a reason (an { exempt } string). That is the same
// shape as tests: existence is machine-enforced here, and whether the demo/
// exemption is honest is a code-review concern on the PR.
//
// The reconcile() core is a pure function so the failure modes are proven with
// SYNTHETIC inputs (a new export, a stale key, a missing demo file, an empty
// reason) without mutating the real framework, plus one assertion over the REAL
// surface that must stay green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as core from '@webjsdev/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '..', '..');
const GALLERY = join(REPO, 'packages', 'cli', 'templates', 'gallery');
const MANIFEST_PATH = join(__dirname, 'gallery-coverage.json');

/**
 * Pure reconciliation. Returns a list of human-readable error strings; empty
 * means fully covered. Injectable file predicates so synthetic cases need no fs.
 *
 * @param {string[]} liveExports  the real export names
 * @param {{ exports: Record<string, {demo?: string, exempt?: string}> }} manifest
 * @param {(rel: string) => boolean} demoFileExists  gallery-relative path -> exists?
 * @param {(rel: string, sym: string) => boolean} demoFileTeaches  file mentions the symbol as a word?
 */
export function reconcile(liveExports, manifest, demoFileExists, demoFileTeaches) {
  const errors = [];
  const entries = manifest.exports || {};
  const classified = new Set(Object.keys(entries));
  const live = new Set(liveExports);

  // 1. Every live export MUST be classified (the tier-2 teeth: a new export fails).
  for (const name of liveExports) {
    if (!classified.has(name)) {
      errors.push(
        `unclassified export "${name}": add a { demo } (a runnable gallery example) ` +
        `or an { exempt } (reason "internal: ..." or "deferred: ...") to ` +
        `test/scaffolds/gallery-coverage.json. The scaffold is the primary teaching ` +
        `surface, so a new @webjsdev/core export must be demoed or consciously exempted.`,
      );
    }
  }

  // 2. No stale manifest keys (export removed or renamed).
  for (const name of classified) {
    if (!live.has(name)) {
      errors.push(`stale manifest entry "${name}": no longer a @webjsdev/core export, remove or rename it.`);
    }
  }

  // 3. Per-entry shape + demo integrity.
  for (const [name, entry] of Object.entries(entries)) {
    if (!live.has(name)) continue; // already reported as stale
    const hasDemo = typeof entry.demo === 'string' && entry.demo.length > 0;
    const hasExempt = typeof entry.exempt === 'string' && entry.exempt.trim().length > 0;
    if (hasDemo === hasExempt) {
      errors.push(`entry "${name}" must have exactly one of { demo } or a non-empty { exempt }.`);
      continue;
    }
    if (hasDemo) {
      if (!demoFileExists(entry.demo)) {
        errors.push(`demo for "${name}" points at "${entry.demo}", which does not exist under the gallery.`);
      } else if (!demoFileTeaches(entry.demo, name)) {
        errors.push(`demo for "${name}" ("${entry.demo}") does not reference "${name}"; point at a file that actually uses it.`);
      }
    }
  }
  return errors;
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const liveExports = Object.keys(core);

const realDemoExists = (rel) => existsSync(join(GALLERY, rel));
const wordRe = (sym) => new RegExp(`\\b${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
const realDemoTeaches = (rel, sym) => {
  try { return wordRe(sym).test(readFileSync(join(GALLERY, rel), 'utf8')); }
  catch { return false; }
};

test('every @webjsdev/core export is demoed in the gallery or consciously exempted', () => {
  const errors = reconcile(liveExports, manifest, realDemoExists, realDemoTeaches);
  const demoed = Object.values(manifest.exports).filter((e) => e.demo).length;
  const internal = Object.values(manifest.exports).filter((e) => e.exempt?.startsWith('internal:')).length;
  const deferred = Object.entries(manifest.exports).filter(([, e]) => e.exempt?.startsWith('deferred:'));
  // Visibility: print the coverage split and the deferred (agent-facing, not-yet-demoed) list every run.
  console.log(
    `[scaffold-coverage] ${liveExports.length} @webjsdev/core exports: ` +
    `${demoed} demoed, ${internal} internal-exempt, ${deferred.length} deferred (agent-facing, not yet demoed).`,
  );
  if (deferred.length) console.log('[scaffold-coverage] deferred: ' + deferred.map(([n]) => n).sort().join(', '));
  assert.deepEqual(errors, [], `scaffold teaching-coverage gaps:\n  - ${errors.join('\n  - ')}`);
});

test('reconcile FAILS on a new unclassified export (the tier-2 teeth)', () => {
  const errors = reconcile(
    [...liveExports, 'brandNewFeature'],
    manifest,
    realDemoExists,
    realDemoTeaches,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /unclassified export "brandNewFeature"/);
});

test('reconcile FAILS on a stale manifest entry (export removed/renamed)', () => {
  const shrunk = liveExports.filter((n) => n !== 'html');
  const errors = reconcile(shrunk, manifest, realDemoExists, realDemoTeaches);
  assert.ok(errors.some((e) => /stale manifest entry "html"/.test(e)), errors.join('\n'));
});

test('reconcile FAILS when a demo pointer references a missing file', () => {
  const m = { exports: { html: { demo: 'app/features/gone/page.ts' } } };
  const errors = reconcile(['html'], m, () => false, () => false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /does not exist under the gallery/);
});

test('reconcile FAILS when a demo file does not actually reference the symbol', () => {
  const m = { exports: { html: { demo: 'app/features/x/page.ts' } } };
  const errors = reconcile(['html'], m, () => true, () => false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /does not reference "html"/);
});

test('reconcile FAILS on an empty exemption reason', () => {
  const m = { exports: { html: { exempt: '   ' } } };
  const errors = reconcile(['html'], m, () => true, () => true);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /exactly one of \{ demo \} or a non-empty \{ exempt \}/);
});
