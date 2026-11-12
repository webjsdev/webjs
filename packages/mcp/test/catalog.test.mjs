/**
 * The feature catalogue (#1686): what a bare `npx webjs source` and a no-args
 * MCP `source` call print. The catalogue is curated, so these tests hold it to
 * the packages: every name is a real export of the module its section names,
 * and every name resolves through `lookupExport`, which is the second call an
 * agent makes after reading the list.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FEATURE_CATALOG, featureCatalog } from '../src/catalog.js';
import { lookupExport, resolveFrameworkRoots, listDir, runSourceTool } from '../src/mcp-source.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Each section's module, read from this checkout's packages (a bare specifier
// could resolve to another checkout's copy).
const MODULE_FILES = {
  '@webjsdev/server': 'packages/server/index.js',
  '@webjsdev/core': 'packages/core/index.js',
  '@webjsdev/core/testing': 'packages/core/src/testing.js',
};

test('every catalogued name is a real export of the module its section names', async () => {
  for (const section of FEATURE_CATALOG) {
    const file = MODULE_FILES[section.module];
    assert.ok(file, `${section.module} has a module file to check against`);
    const mod = await import(pathToFileURL(resolve(REPO, file)).href);
    for (const g of section.groups) {
      for (const name of g.names) {
        assert.ok(name in mod, `${name} (${g.need}) is exported by ${section.module}`);
      }
    }
  }
});

test('every catalogued name resolves through lookupExport, the follow-up call', async () => {
  const roots = resolveFrameworkRoots(REPO, { exists: existsSync });
  const deps = { roots, readFile, readdir: listDir };
  for (const section of FEATURE_CATALOG) {
    const pkg = section.module.split('/')[1];
    for (const g of section.groups) {
      for (const name of g.names) {
        const out = await lookupExport(deps, name, pkg);
        assert.match(out, /^@webjsdev\//m, `source ${name} --pkg ${pkg} finds a declaration`);
      }
    }
  }
});

// The WebJs-specific exports, the ones no Lit or Next.js habit covers. The
// catalogue promises each comes back with a working example, so the lookup an
// agent makes instead of reading the source answers "how do I use this" in one
// call. Explicit rather than derived from the catalogue: a name added there
// that a habit does cover (html, redirect) needs no example of its own. The
// package is pinned where a name exists in both (`cache` is also a core
// directive, `cspNonce` is also a server export).
const NEEDS_EXAMPLE = [
  ['Credentials', 'server'], ['rateLimit', 'server'], ['cors', 'server'], ['clientIp', 'server'],
  ['cache', 'server'], ['revalidateTag', 'server'], ['setFileStore', 'server'], ['diskStore', 'server'],
  ['generateKey', 'server'], ['signedUrl', 'server'], ['verifySignedUrl', 'server'], ['broadcast', 'server'],
  ['stream', 'server'], ['streamResponse', 'server'], ['acceptsStream', 'server'], ['json', 'server'],
  ['readBody', 'server'], ['route', 'server'], ['sitemap', 'server'], ['robots', 'server'],
  ['validateEnv', 'server'], ['testRequest', 'server'], ['loginAndGetCookies', 'server'],
  ['createRequestHandler', 'server'],
  ['connectWS', 'core'], ['asset', 'core'], ['cspNonce', 'core'], ['fixture', 'core'], ['ssrFixture', 'core'],
];

test('every WebJs-specific export comes back from lookupExport with an @example', async () => {
  const roots = resolveFrameworkRoots(REPO, { exists: existsSync });
  const deps = { roots, readFile, readdir: listDir };
  for (const [name, pkg] of NEEDS_EXAMPLE) {
    const out = await lookupExport(deps, name, pkg);
    assert.match(out, /^@webjsdev\//m, `source ${name} --pkg ${pkg} finds a declaration`);
    assert.match(out, /@example/, `source ${name} --pkg ${pkg} prints an example`);
  }
});

test('the catalogue text names every entry and stays short', () => {
  const text = featureCatalog();
  for (const section of FEATURE_CATALOG) {
    assert.ok(text.includes(`\n${section.module}\n`), `heads the ${section.module} section`);
    for (const g of section.groups) {
      assert.ok(text.includes(`  ${g.need}: ${g.names.join(', ')}`), `lists ${g.need}`);
    }
  }
  assert.match(text, /npx webjs source <Name>/, 'says how to fetch one entry');
  // Read on a discovery call, so it is a list, not documentation.
  assert.ok(text.length < 2500, `the catalogue stays under 2500 characters (${text.length})`);
});

// #1697: the facts agents in the eval builds grepped node_modules for, after
// reading this very listing. Each cost one to sixteen turns across builds.
test('the catalogue answers the lookups agents grepped the framework source for', () => {
  const text = featureCatalog();
  assert.match(text, /fresh migrated database, never db\/dev\.db/, 'which database `webjs test` uses');
  assert.match(text, /webjs db seed then runs db\/seed\.server\.ts once as a\nplain script/, 'which file the seed command runs, and how (#1697 round 9: agents still asked how)');
  assert.match(text, /renders per request unless it exports revalidate/, 'whether pages are cached by default');
  assert.match(text, /GET\(req, \{ params \}\)/, 'what a route handler receives');
});

test('the MCP source tool returns the catalogue for no arguments, and a listing for `package`', async () => {
  const deps = { roots: [], readFile, readdir: listDir };
  assert.equal(await runSourceTool(deps, {}), featureCatalog());
  assert.equal(await runSourceTool(deps, undefined), featureCatalog());
  assert.doesNotMatch(await runSourceTool(deps, { package: 'core' }), /What WebJs provides/, 'a package listing is not the catalogue');
});
