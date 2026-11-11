/**
 * The pattern guides (#1692): `npx webjs source <guide>` and the MCP `source`
 * tool given a guide name. They are held to the same discipline as the
 * catalogue: short, and every export and generator a guide tells the agent to
 * reach for has to exist, so a guide cannot send an agent to a dead end.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUIDES, guide } from '../src/guides.js';
import { featureCatalog } from '../src/catalog.js';
import { lookupExport, resolveFrameworkRoots, listDir, runSourceTool } from '../src/mcp-source.js';
import { GENERATORS } from '../../cli/lib/generate/index.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const deps = { roots: resolveFrameworkRoots(REPO, { exists: existsSync }), readFile, readdir: listDir };

test('every guide is short and ends in actions: a generator or a lookup, and a docs page', () => {
  for (const [name, g] of Object.entries(GUIDES)) {
    const lines = g.text.split('\n').length;
    assert.ok(lines < 40, `${name} stays under 40 lines (${lines})`);
    assert.match(g.text, new RegExp(`^Guide: ${name} \\(`), `${name} names itself first`);
    assert.match(g.text, /npx webjs (g|source) /, `${name} names a command to run`);
    assert.match(g.text, /^Docs: https:\/\/webjs\.dev\/docs\/[a-z-]+$/m, `${name} links its docs page`);
  }
});

test('every export a guide says to look up resolves, and every generator it names exists', async () => {
  for (const [name, g] of Object.entries(GUIDES)) {
    for (const m of g.text.matchAll(/npx webjs source ([A-Za-z][\w-]*)/g)) {
      const target = m[1];
      if (guide(target)) continue;
      const out = await lookupExport(deps, target);
      assert.match(out, /^@webjsdev\//m, `${name}: \`npx webjs source ${target}\` finds a declaration`);
    }
    for (const m of g.text.matchAll(/npx webjs g ([a-z]+)/g)) {
      assert.ok(GENERATORS.includes(m[1]), `${name}: \`npx webjs g ${m[1]}\` is a real generator`);
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

test('the source tool answers a guide name through `export`, and the catalogue lists every guide', async () => {
  assert.equal(await runSourceTool(deps, { export: 'modules' }), GUIDES.modules.text);
  assert.match(await runSourceTool(deps, { export: 'optimistic' }), /^@webjsdev\/core/m);
  const catalogue = featureCatalog();
  for (const [name, g] of Object.entries(GUIDES)) assert.ok(catalogue.includes(`  ${name}: ${g.need}`), `lists ${name}`);
});
