// Drift guard: the scaffold's committed copy of the agent skill
// (packages/cli/templates/.agents/skills/webjs/) MUST be byte-identical to the
// canonical skill at the repo root (.agents/skills/webjs/). The canonical one
// is what the framework AGENTS.md and the MCP read; the template copy is what
// `webjs create` ships. scripts/sync-scaffold-skill.mjs regenerates the copy;
// this test fails if someone edits one without syncing the other.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const canonical = join(repoRoot, '.agents', 'skills', 'webjs');
const templateCopy = join(repoRoot, 'packages', 'cli', 'templates', '.agents', 'skills', 'webjs');

/** Relative file list under a dir, sorted. */
function walk(root, dir = root, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(root, full, out);
    else out.push(full.slice(root.length + 1));
  }
  return out;
}

test('scaffold skill copy is byte-identical to the canonical repo-root skill', () => {
  const a = walk(canonical);
  const b = walk(templateCopy);
  assert.deepEqual(a, b, 'the two skill trees must contain the same files (run scripts/sync-scaffold-skill.mjs)');
  for (const rel of a) {
    assert.equal(
      readFileSync(join(templateCopy, rel), 'utf8'),
      readFileSync(join(canonical, rel), 'utf8'),
      `${rel} differs between the canonical skill and the scaffold copy (run scripts/sync-scaffold-skill.mjs)`,
    );
  }
});
