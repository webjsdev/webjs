/**
 * The pattern guides (#1692): `npx webjs source <guide>` and the MCP `source`
 * tool given a guide name. They are held to the same discipline as the
 * catalogue: short, and every export a guide tells the agent to look up has to
 * exist, so a guide cannot send an agent to a dead end.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDES, GUIDE_ALIASES, guide, conventionPointer } from '../src/guides.js';
import { featureCatalog } from '../src/catalog.js';
import { lookupExport, resolveFrameworkRoots, listDir, runSourceTool } from '../src/mcp-source.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const deps = { roots: resolveFrameworkRoots(REPO, { exists: existsSync }), readFile, readdir: listDir };

test('every guide is short and ends in actions: a lookup and a docs page', () => {
  for (const [name, g] of Object.entries(GUIDES)) {
    const lines = g.text.split('\n').length;
    assert.ok(lines < 40, `${name} stays under 40 lines (${lines})`);
    assert.match(g.text, new RegExp(`^Guide: ${name} \\(`), `${name} names itself first`);
    assert.match(g.text, /npx webjs source /, `${name} names a lookup to run`);
    assert.match(g.text, /^Docs: https:\/\/webjs\.dev\/docs\/[a-z-]+$/m, `${name} links its docs page`);
  }
});

test('every export a guide says to look up resolves', async () => {
  for (const [name, g] of Object.entries(GUIDES)) {
    for (const m of g.text.matchAll(/npx webjs source ([A-Za-z][\w-]*)/g)) {
      const target = m[1];
      if (guide(target)) continue;
      const out = await lookupExport(deps, target);
      assert.match(out, /^@webjsdev\//m, `${name}: \`npx webjs source ${target}\` finds a declaration`);
    }
  }
});

test('a guide name is never an export name, so looking up an export never lands on a guide', async () => {
  for (const name of Object.keys(GUIDES)) {
    const out = await lookupExport(deps, name);
    assert.doesNotMatch(out, /^@webjsdev\//m, `${name} is not an export of any package`);
  }
  // optimistic is the export; optimistic-ui is the guide.
  assert.equal(guide('optimistic'), null);
  assert.equal(guide('Optimistic UI'), GUIDES['optimistic-ui'].text);
});

test('the source tool answers a guide name through `export`, and the catalogue lists no guide', async () => {
  assert.equal(await runSourceTool(deps, { export: 'modules' }), GUIDES.modules.text);
  assert.match(await runSourceTool(deps, { export: 'optimistic' }), /^@webjsdev\/core/m);
  // A guide is read only when asked for by name: listing them up front had
  // agents read several before writing any code.
  const catalogue = featureCatalog();
  assert.doesNotMatch(catalogue, /Guides/);
  for (const [name, g] of Object.entries(GUIDES)) assert.ok(!catalogue.includes(`  ${name}: ${g.need}`), `does not list ${name}`);
});

test('a file convention name finds the routing guide, and no alias shadows an export', async () => {
  for (const name of ['not-found', 'notfound', 'error', 'loading', 'middleware.ts', 'route.ts', 'routing', 'layout', 'page', 'forbidden.ts', 'unauthorized.ts', 'app/page.ts', 'layout.js']) {
    assert.equal(guide(name), GUIDES.routing.text, `${name} prints the routing guide`);
    assert.equal(await runSourceTool(deps, { export: name }), GUIDES.routing.text, `the MCP tool answers ${name} the same`);
  }
  for (const alias of Object.keys(GUIDE_ALIASES)) {
    const out = await lookupExport(deps, alias);
    assert.doesNotMatch(out, /^@webjsdev\//m, `${alias} is not an export of any package, so the guide hides nothing`);
  }
});

test('the exports a convention is named after still print the export', async () => {
  for (const name of ['notFound', 'forbidden', 'unauthorized', 'redirect', 'route', 'middleware']) {
    assert.equal(guide(name), null, `${name} is not answered by a guide`);
    assert.match(await runSourceTool(deps, { export: name }), /^@webjsdev\//m, `${name} prints its declaration`);
  }
  // route() and the Middleware type share a name with route.ts and middleware.ts.
  for (const name of ['route', 'middleware']) {
    assert.match(await runSourceTool(deps, { export: name }), /\n\nFor the route\.ts \/ middleware\.ts file convention: npx webjs source routing$/);
  }
  assert.equal(conventionPointer('notFound'), null);
  assert.doesNotMatch(await runSourceTool(deps, { export: 'notFound' }), /file convention/);
});

test('the upload words find the uploads guide, which serves from its own route with a matching signed base', async () => {
  for (const name of ['uploads', 'upload', 'file-upload', 'attachments', 'Uploads']) {
    assert.equal(guide(name), GUIDES.uploads.text, `${name} prints the uploads guide`);
    assert.equal(await runSourceTool(deps, { export: name }), GUIDES.uploads.text);
  }
  const text = GUIDES.uploads.text;
  // The default base is the store's /uploads/<key>, which nothing serves, so the
  // link must name the route that does.
  assert.match(text, /\/\/ app\/files\/\[key\]\/route\.ts/);
  assert.match(text, /signedUrl\([^)]*base: '\/files\/' \+/);
  assert.match(text, /verifySignedUrl\(/);
  assert.match(text, /'x-content-type-options': 'nosniff'/);
  assert.match(text, /5 \* 1024 \* 1024/);
});
