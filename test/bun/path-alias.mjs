/**
 * Cross-runtime proof that the `#/` path alias (#555) resolves natively under
 * WHICHEVER runtime runs it. The alias is Node's `package.json "imports"` field,
 * which both Node 24+ and Bun resolve at module-load with no build step. webjs
 * runs on both (#508), so the alias must load identically on each:
 *
 *   node test/bun/path-alias.mjs
 *   bun  test/bun/path-alias.mjs
 *
 * Builds a throwaway package with `"imports": { "#/*": "./*" }`, a target module,
 * and an entry that imports it via `#/`, then dynamically imports the entry and
 * asserts the aliased value round-tripped. This is the runtime-loading half (the
 * server graph / importmap half is covered by the Node unit tests). Run from the
 * repo root so node:* resolves.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const dir = mkdtempSync(join(tmpdir(), 'webjs-pathalias-x-'));
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'alias-fixture', type: 'module', imports: { '#*': './*' } }));
  mkdirSync(join(dir, 'lib'), { recursive: true });
  writeFileSync(join(dir, 'lib', 'value.js'), 'export const value = 42;\n');
  // The entry imports its sibling via the # root alias, not a relative path.
  writeFileSync(join(dir, 'entry.js'), "import { value } from '#lib/value.js';\nexport const doubled = value * 2;\n");

  const mod = await import(pathToFileURL(join(dir, 'entry.js')).href);
  assert.equal(mod.doubled, 84, '# alias resolved natively to the real module');

  console.log(`OK  webjs # path alias resolved natively on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
