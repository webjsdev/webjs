/**
 * Unit tests for the MCP knowledge layer's PURE functions (#376):
 * `mcp-docs.js`. Everything is driven with INJECTED deps (an in-memory corpus),
 * so these never touch the real filesystem and prove the logic independent of
 * the dispatch/transport tested in `mcp.test.mjs`.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const {
  catalogue,
  listResources,
  readResource,
  sectionByHeading,
  initText,
  searchDocs,
  getPrompt,
  PROMPTS,
  resolveDocsLocation,
} = await import(resolve(REPO, 'packages', 'cli', 'lib', 'mcp-docs.js'));
const { bundleDocs } = await import(resolve(REPO, 'packages', 'cli', 'scripts', 'copy-mcp-resources.js'));
const { cleanBundle } = await import(resolve(REPO, 'packages', 'cli', 'scripts', 'clean-mcp-resources.js'));

const _cleanup = [];
after(() => { for (const d of _cleanup) rmSync(d, { recursive: true, force: true }); });

/** An in-memory corpus: a fake docsDir + AGENTS.md, no real fs. */
function fixture() {
  const files = {
    '/docs/components.md': '# Components\n\nUse signals.\n',
    '/docs/recipes.md': '# Recipes\n\n## Add a page\n\nexport default fn.\n',
    '/AGENTS.md':
      '# AGENTS\n\n' +
      '## Execution model\n\nNo RSC. Components hydrate, pages do not.\n\n' +
      '## Public API\n\nhtml, css.\n\n' +
      '## Invariants\n\n1. Server-only code in .server files.\n2. Tags need a hyphen.\n\n' +
      '## Scaffolding\n\nuse webjs create.\n',
  };
  return {
    docsDir: '/docs',
    agentsPath: '/AGENTS.md',
    listDir: (d) => (d === '/docs' ? ['components.md', 'recipes.md'] : []),
    exists: (p) => p in files,
    readFile: async (p) => {
      if (!(p in files)) throw new Error('ENOENT ' + p);
      return files[p];
    },
  };
}

test('catalogue: AGENTS first, then the agent-docs, each with a webjs-docs:// uri', () => {
  const cat = catalogue(fixture());
  assert.deepEqual(cat.map((d) => d.name), ['AGENTS', 'components', 'recipes']);
  assert.equal(cat[0].uri, 'webjs-docs://AGENTS');
  assert.equal(cat[1].uri, 'webjs-docs://components');
});

test('listResources: descriptors carry uri, name, title, markdown mime', () => {
  const res = listResources(fixture());
  assert.ok(res.every((r) => r.uri.startsWith('webjs-docs://') && r.mimeType === 'text/markdown' && r.name && r.title));
});

test('readResource: returns the doc text; unknown uri throws', async () => {
  const deps = fixture();
  const r = await readResource(deps, 'webjs-docs://components');
  assert.match(r.text, /Use signals/);
  await assert.rejects(() => readResource(deps, 'webjs-docs://nope'), /Unknown resource/);
});

test('sectionByHeading: extracts a section up to the next same-level heading', () => {
  const md = fixture().readFile;
  // Use a literal to avoid awaiting; mirror the AGENTS fixture body.
  const agents =
    '## Execution model\n\nNo RSC here.\n\n## Invariants\n\n1. one\n2. two\n\n## Next\n\nx\n';
  const exec = sectionByHeading(agents, /^##\s+Execution model/im);
  assert.match(exec, /^## Execution model/);
  assert.match(exec, /No RSC here/);
  assert.ok(!exec.includes('Invariants'), 'stops at the next ## heading');
  const inv = sectionByHeading(agents, /^##\s+Invariants/im);
  assert.match(inv, /1\. one/);
  assert.ok(!inv.includes('Next'), 'stops at the following heading');
  // Counterfactual: a missing heading yields ''.
  assert.equal(sectionByHeading(agents, /^##\s+Nonexistent/im), '');
  void md;
});

test('initText: sources Execution model + Invariants from AGENTS, steers off React, lists resources', async () => {
  const text = await initText(fixture());
  assert.match(text, /No RSC/, 'pulls the execution-model section');
  assert.match(text, /Server-only code in \.server files/, 'pulls the invariants section');
  assert.match(text, /NOT React\/Next/, 'explicit anti-React steer in the router');
  assert.match(text, /webjs-docs:\/\/components/, 'lists the corpus');
});

test('searchDocs: topic returns the doc, query returns tagged hits, no-args returns the index', async () => {
  const deps = fixture();
  assert.match(await searchDocs(deps, { topic: 'components' }), /Use signals/);
  assert.match(await searchDocs(deps, { topic: 'AGENTS' }), /Execution model/);
  const hits = await searchDocs(deps, { query: 'signals' });
  assert.match(hits, /\[webjs-docs:\/\/components\]/, 'a hit is tagged with its source uri');
  assert.match(await searchDocs(deps, {}), /topics/i);
  assert.match(await searchDocs(deps, { topic: 'missing' }), /Unknown topic/);
  assert.match(await searchDocs(deps, { query: 'zzzznotfound' }), /No matches/);
});

function bigCorpus(matchCount) {
  const many = Array.from({ length: matchCount }, (_, i) => `signal line ${i}`).join('\n');
  return {
    docsDir: '/docs',
    agentsPath: '/AGENTS.md',
    listDir: () => ['big.md'],
    exists: () => false,
    readFile: async () => `# Big\n\n${many}\n`,
  };
}

test('searchDocs: > 40 matches caps AND discloses the truncation (no silent cap)', async () => {
  const out = await searchDocs(bigCorpus(60), { query: 'signal line' });
  const lines = out.split('\n');
  // 40 hits + the disclosure line.
  assert.equal(lines.length, 41, 'caps the hit list at 40 plus the disclosure');
  assert.match(out, /truncated at 40 matches/, 'discloses the cap rather than silently dropping');
});

test('searchDocs: EXACTLY 40 matches does NOT claim truncation (boundary)', async () => {
  const out = await searchDocs(bigCorpus(40), { query: 'signal line' });
  assert.equal(out.split('\n').length, 40, '40 hits, no disclosure line');
  assert.ok(!/truncated/.test(out), 'nothing was dropped, so no truncation notice');
});

test('resolveDocsLocation: prefers the bundled resources/, falls back to repo-root agent-docs', () => {
  // Build a fake package layout: <root>/packages/cli/lib (the module location),
  // <root>/agent-docs (the dev fallback), <root>/packages/cli/resources (bundled).
  const root = mkdtempSync(join(tmpdir(), 'mcp-resolve-'));
  _cleanup.push(root);
  const libDir = join(root, 'packages', 'cli', 'lib');
  const bundled = join(root, 'packages', 'cli', 'resources', 'agent-docs');
  mkdirSync(libDir, { recursive: true });
  mkdirSync(join(root, 'agent-docs'), { recursive: true });
  writeFileSync(join(root, 'AGENTS.md'), '# root\n');
  const moduleUrl = pathToFileURL(join(libDir, 'mcp-docs.js')).href;

  // No bundle yet -> dev fallback to the repo-root agent-docs + AGENTS.md.
  let loc = resolveDocsLocation(moduleUrl);
  assert.equal(loc.docsDir, join(root, 'agent-docs'), 'falls back to repo-root agent-docs');
  assert.equal(loc.agentsPath, join(root, 'AGENTS.md'));

  // Bundle present -> the published path wins.
  mkdirSync(bundled, { recursive: true });
  writeFileSync(join(root, 'packages', 'cli', 'resources', 'AGENTS.md'), '# bundled\n');
  loc = resolveDocsLocation(moduleUrl);
  assert.equal(loc.docsDir, bundled, 'prefers the bundled resources/agent-docs');
  assert.equal(loc.agentsPath, join(root, 'packages', 'cli', 'resources', 'AGENTS.md'));
});

test('bundleDocs + cleanBundle: copy bundles agent-docs + AGENTS, clean removes it (temp dirs only)', () => {
  // Operate entirely in a throwaway layout, NEVER the real packages/cli/resources
  // (which would race the integration tests reading the live corpus).
  const root = mkdtempSync(join(tmpdir(), 'mcp-bundle-'));
  _cleanup.push(root);
  const srcDocs = join(root, 'src', 'agent-docs');
  const srcAgents = join(root, 'src', 'AGENTS.md');
  const destRoot = join(root, 'pkg', 'resources');
  mkdirSync(srcDocs, { recursive: true });
  writeFileSync(join(srcDocs, 'components.md'), '# Components\n');
  writeFileSync(join(srcDocs, 'recipes.md'), '# Recipes\n');
  writeFileSync(srcAgents, '# AGENTS\n');

  bundleDocs({ srcDocs, srcAgents, destRoot });
  assert.ok(existsSync(join(destRoot, 'AGENTS.md')), 'AGENTS.md bundled');
  assert.deepEqual(readdirSync(join(destRoot, 'agent-docs')).sort(), ['components.md', 'recipes.md'], 'docs bundled');

  // A re-bundle with a removed source doc must not leave the old one behind.
  rmSync(join(srcDocs, 'recipes.md'));
  bundleDocs({ srcDocs, srcAgents, destRoot });
  assert.deepEqual(readdirSync(join(destRoot, 'agent-docs')), ['components.md'], 'stale doc cleaned on re-bundle');

  cleanBundle(destRoot);
  assert.ok(!existsSync(destRoot), 'cleanBundle removed the transient bundle');
});

test('getPrompt: every listed prompt resolves to a user message; unknown throws', () => {
  for (const p of PROMPTS) {
    const got = getPrompt(p.name, {});
    assert.equal(got.messages[0].role, 'user');
    assert.ok(got.messages[0].content.text.length > 50);
    assert.match(got.messages[0].content.text, /webjs-docs:\/\/recipes/, 'points at the full recipe set');
  }
  assert.throws(() => getPrompt('nope', {}), /Unknown prompt/);
});
