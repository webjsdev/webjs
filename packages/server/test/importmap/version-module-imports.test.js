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

test('normalizes a .js specifier to the .ts file on disk, so it matches the preload (#369 review)', () => {
  // The author writes `import './widget.js'` but the file is widget.ts. The
  // modulepreload href is derived from the resolved path (`/...widget.ts?v=H`),
  // so the served import must point at `.ts`, not `.js`, or the preload is
  // wasted and the module double-fetched.
  const bytes = 'export class W {}\n';
  writeFileSync(join(appDir, 'components', 'widget.ts'), bytes);
  setAssetRoots({ appDir, coreDir, enabled: true });
  const h = shortHash(bytes);
  const out = versionModuleImports("import '../components/widget.js';\n", join(appDir, 'app', 'page.ts'));
  assert.equal(out, `import '../components/widget.ts?v=${h}';\n`);
  assert.equal(withAssetHash('/components/widget.ts'), `/components/widget.ts?v=${h}`, 'matches the preload href');
});

test('appends the resolved extension to an extensionless specifier', () => {
  const bytes = 'export class W {}\n';
  writeFileSync(join(appDir, 'components', 'widget.ts'), bytes);
  setAssetRoots({ appDir, coreDir, enabled: true });
  const h = shortHash(bytes);
  const out = versionModuleImports("import '../components/widget';\n", join(appDir, 'app', 'page.ts'));
  assert.equal(out, `import '../components/widget.ts?v=${h}';\n`);
});

test('does NOT rewrite an import written inside a PLAIN string literal (#369 review, byte-corruption guard)', () => {
  // The default redaction mask keeps plain-string bodies verbatim (so
  // register('tag') stays readable), so this would slip through a keyword-only
  // guard and corrupt the served string. The blankStrings mask prevents it.
  writeFileSync(join(appDir, 'components', 'theme-toggle.ts'), 'export class T {}\n');
  setAssetRoots({ appDir, coreDir, enabled: true });
  const src = "export const SNIPPET = \"import '../components/theme-toggle.ts'\";\n";
  assert.equal(versionModuleImports(src, join(appDir, 'app', 'page.ts')), src, 'the string value is untouched');
});

test('does NOT version a root-absolute specifier (basePath-unsafe; pre-existing author limitation)', () => {
  writeFileSync(join(appDir, 'components', 'x.ts'), 'export class X {}\n');
  setAssetRoots({ appDir, coreDir, enabled: true });
  const src = "import '/components/x.ts';\n";
  assert.equal(versionModuleImports(src, join(appDir, 'app', 'page.ts')), src);
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

test('versions a #/ path-alias import as a base-path-safe relative specifier (#555)', () => {
  // A `#/` alias resolves via the importmap (`#/`->`/`), which carries NO `?v`,
  // so without this the alias import would fetch the un-versioned URL while the
  // preload points at `?v=hash` (the #369 wasted-preload class, but for aliases).
  // The pass rewrites it to a versioned RELATIVE specifier: base-path-safe (the
  // browser resolves it against the importer's own URL, not the importmap) and
  // carrying the same `?v` as the preload, collapsing fetch + preload to one
  // immutable cache key.
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'x', type: 'module', imports: { '#components/*': './components/*', '#lib/*': './lib/*' } }));
  const badgeBytes = 'export class B {}\n';
  writeFileSync(join(appDir, 'components', 'badge.ts'), badgeBytes);
  setAssetRoots({ appDir, coreDir, enabled: true });

  const pageAbs = join(appDir, 'app', 'page.ts');
  const out = versionModuleImports("import '#components/badge.ts';\n", pageAbs);

  const h = shortHash(badgeBytes);
  // app/page.ts -> components/badge.ts is `../components/badge.ts`.
  assert.equal(out, `import '../components/badge.ts?v=${h}';\n`);
  // The browser resolves that relative specifier against `/app/page.ts` to
  // `/components/badge.ts?v=H`, byte-identical to the modulepreload href.
  assert.equal(withAssetHash('/components/badge.ts'), `/components/badge.ts?v=${h}`);
});

test('a #/ alias to a .server.ts is NOT versioned (server stub, bare URL, not preloaded)', () => {
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'x', type: 'module', imports: { '#components/*': './components/*', '#lib/*': './lib/*' } }));
  writeFileSync(join(appDir, 'lib', 'db.server.ts'), "export const db = {};\n");
  setAssetRoots({ appDir, coreDir, enabled: true });

  const pageAbs = join(appDir, 'app', 'page.ts');
  const src = "import { db } from '#lib/db.server.ts';\n";
  // A .server.* target serves as a stub at a bare URL and is never in the
  // preload set, so it is left untouched (same as a relative .server import).
  assert.equal(versionModuleImports(src, pageAbs), src);
});
