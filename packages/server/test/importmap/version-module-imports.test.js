/**
 * Unit tests for `versionModuleImports` (issue #369): the serve-time pass that
 * appends `?v=<hash>` to same-origin relative / root-absolute static-import
 * specifiers in a served module's source, so the URL the browser fetches for a
 * nested import matches the `?v=`-versioned modulepreload hint + boot specifier
 * the framework emits for that file.
 *
 * The headline invariant proved here: the `?v` baked into a nested import is
 * BYTE-IDENTICAL to what `withAssetHash` computes for the same file's
 * modulepreload href, so the browser dedupes the preload and the fetch onto one
 * immutable cache key instead of downloading the module twice.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import {
  setAssetRoots,
  clearAssetHashCache,
  withAssetHash,
  versionModuleImports,
} from '../../src/asset-hash.js';

let root;
let appDir;
let coreDir;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'webjs-versimports-'));
  appDir = join(root, 'app-root');
  coreDir = join(root, 'core-root');
  mkdirSync(join(appDir, 'app'), { recursive: true });
  mkdirSync(join(appDir, 'components'), { recursive: true });
  mkdirSync(join(appDir, 'lib'), { recursive: true });
  mkdirSync(coreDir, { recursive: true });
  clearAssetHashCache();
});
afterEach(() => {
  setAssetRoots({ appDir: '', coreDir: '', enabled: false });
  clearAssetHashCache();
  rmSync(root, { recursive: true, force: true });
});

function shortHash(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 12);
}

test('appends ?v=<hash> to a relative side-effect import, matching the preload href', () => {
  const themeBytes = 'export class T {}\n';
  writeFileSync(join(appDir, 'components', 'theme-toggle.ts'), themeBytes);
  setAssetRoots({ appDir, coreDir, enabled: true });

  const layoutAbs = join(appDir, 'app', 'layout.ts');
  const out = versionModuleImports("import '../components/theme-toggle.ts';\n", layoutAbs);

  const h = shortHash(themeBytes);
  assert.equal(out, `import '../components/theme-toggle.ts?v=${h}';\n`);
  // The exact URL the modulepreload href carries for the same file: identical.
  assert.equal(withAssetHash('/components/theme-toggle.ts'), `/components/theme-toggle.ts?v=${h}`);
});

test('versions binding imports and `export … from` re-exports', () => {
  const linksBytes = 'export const A = 1;\n';
  writeFileSync(join(appDir, 'lib', 'links.ts'), linksBytes);
  setAssetRoots({ appDir, coreDir, enabled: true });

  const fromAbs = join(appDir, 'app', 'page.ts');
  const h = shortHash(linksBytes);

  const named = versionModuleImports("import { A } from '../lib/links.ts';\n", fromAbs);
  assert.equal(named, `import { A } from '../lib/links.ts?v=${h}';\n`);

  const reexport = versionModuleImports("export { A } from '../lib/links.ts';\n", fromAbs);
  assert.equal(reexport, `export { A } from '../lib/links.ts?v=${h}';\n`);

  const ns = versionModuleImports("import * as links from '../lib/links.ts';\n", fromAbs);
  assert.equal(ns, `import * as links from '../lib/links.ts?v=${h}';\n`);
});

test('leaves a bare specifier untouched (importmap-resolved, versioned at its target)', () => {
  setAssetRoots({ appDir, coreDir, enabled: true });
  const src = "import { html } from '@webjsdev/core';\nimport '@webjsdev/core/client-router';\n";
  assert.equal(versionModuleImports(src, join(appDir, 'app', 'layout.ts')), src);
});

test('leaves a .server.* import untouched (served as a stub at a bare URL)', () => {
  writeFileSync(join(appDir, 'lib', 'db.server.ts'), "export async function q() {}\n");
  setAssetRoots({ appDir, coreDir, enabled: true });
  const src = "import { q } from '../lib/db.server.ts';\n";
  assert.equal(versionModuleImports(src, join(appDir, 'app', 'page.ts')), src);
});

test('does not rewrite an import shown as example code inside a template literal', () => {
  writeFileSync(join(appDir, 'components', 'x.ts'), 'export class X {}\n');
  setAssetRoots({ appDir, coreDir, enabled: true });
  // The real import (line 1) is versioned; the one inside the html`` template
  // (example code rendered to the page) is left verbatim.
  const src =
    "import '../components/x.ts';\n" +
    "export const doc = html`<pre>import '../components/x.ts';</pre>`;\n";
  const out = versionModuleImports(src, join(appDir, 'app', 'page.ts'));
  const h = shortHash('export class X {}\n');
  assert.equal(
    out,
    `import '../components/x.ts?v=${h}';\n` +
      "export const doc = html`<pre>import '../components/x.ts';</pre>`;\n",
    'only the real top-level import is versioned; the templated example text is untouched',
  );
});

test('leaves a specifier that already carries a query as-is', () => {
  writeFileSync(join(appDir, 'components', 'x.ts'), 'export class X {}\n');
  setAssetRoots({ appDir, coreDir, enabled: true });
  const src = "import '../components/x.ts?foo=1';\n";
  assert.equal(versionModuleImports(src, join(appDir, 'app', 'page.ts')), src);
});

test('fails safe (no rewrite) for a specifier that does not resolve to a readable file', () => {
  setAssetRoots({ appDir, coreDir, enabled: true });
  const src = "import '../components/missing.ts';\n";
  // resolveImport returns an optimistic path; the hash read fails -> left as-is.
  assert.equal(versionModuleImports(src, join(appDir, 'app', 'page.ts')), src);
});

test('is a byte-identical no-op when fingerprinting is disabled (dev)', () => {
  writeFileSync(join(appDir, 'components', 'theme-toggle.ts'), 'export class T {}\n');
  setAssetRoots({ appDir, coreDir, enabled: false });
  const src = "import '../components/theme-toggle.ts';\n";
  assert.equal(versionModuleImports(src, join(appDir, 'app', 'layout.ts')), src);
});

test('counterfactual: with the pass active the served import URL matches the preload, without it they diverge', () => {
  const bytes = 'export class T {}\n';
  writeFileSync(join(appDir, 'components', 'theme-toggle.ts'), bytes);
  setAssetRoots({ appDir, coreDir, enabled: true });
  const layoutAbs = join(appDir, 'app', 'layout.ts');

  const versioned = versionModuleImports("import '../components/theme-toggle.ts';\n", layoutAbs);
  const preloadHref = withAssetHash('/components/theme-toggle.ts');

  // The served import now carries the SAME hash the preload href does. Resolved
  // against the importer URL, `../components/theme-toggle.ts?v=<h>` becomes
  // `/components/theme-toggle.ts?v=<h>`, identical to the preload -> one fetch.
  const h = shortHash(bytes);
  assert.ok(versioned.includes(`?v=${h}`), 'the rewrite appended the version token');
  assert.equal(preloadHref, `/components/theme-toggle.ts?v=${h}`);

  // The bug being fixed: the UN-rewritten source (what shipped before this pass)
  // requests the bare URL, a different cache key from the preload -> double fetch.
  const bare = "import '../components/theme-toggle.ts';\n";
  assert.ok(!bare.includes('?v='), 'pre-fix source has no version token, so it 404s the preload cache key');
  assert.notEqual(versioned, bare, 'the pass changes the served bytes');
});
