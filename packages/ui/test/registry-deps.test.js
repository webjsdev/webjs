/**
 * Registry dependency completeness: a component copied by `webjs ui add`
 * only brings the files declared in its `registryDependencies` tree (the
 * resolver walks that field, it does NOT follow relative imports). So a
 * component that imports a SIBLING component (`./other.ts`) must declare
 * that sibling, or the copied file lands with a broken import.
 *
 * `../lib/utils.ts` is the one exception: the add command rewrites that
 * specific import to the project's configured utils path (written by
 * `webjsui init`), so it does not need a `lib-utils` registry dependency.
 *
 * This guards the #655 class of bug where tooltip / hover-card /
 * dropdown-menu imported `./popover.ts`, toggle-group imported
 * `./toggle.ts`, and dialog imported `./button.ts` without declaring them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry');
const COMPONENTS_DIR = join(ROOT, 'components');

const manifest = JSON.parse(readFileSync(join(ROOT, 'registry.json'), 'utf8'));

// Map a component file path (as listed in the manifest) to its item name.
const fileToItem = new Map();
for (const item of manifest.items) {
  for (const f of item.files || []) fileToItem.set(f.path, item.name);
}

test('every sibling-component import is declared in registryDependencies', () => {
  const gaps = [];
  for (const file of readdirSync(COMPONENTS_DIR)) {
    if (!file.endsWith('.ts')) continue;
    const relPath = `components/${file}`;
    const name = fileToItem.get(relPath);
    if (!name) continue; // not a registry item (e.g. an internal helper)
    const src = readFileSync(join(COMPONENTS_DIR, file), 'utf8');
    // Match a same-directory sibling import under either quote style.
    const siblings = new Set(
      [...src.matchAll(/from\s+['"]\.\/([a-z0-9-]+)\.ts['"]/g)].map((m) => m[1]),
    );
    const declared = new Set(
      (manifest.items.find((i) => i.name === name).registryDependencies) || [],
    );
    for (const sib of siblings) {
      if (!declared.has(sib)) gaps.push(`${name} imports ./${sib}.ts but does not declare it`);
    }
  }
  assert.deepEqual(gaps, [], `registry dependency gaps:\n${gaps.join('\n')}`);
});

test('declared registryDependencies reference real registry items', () => {
  const names = new Set(manifest.items.map((i) => i.name));
  // `lib-utils` is a registry:lib item; include any non-component items too.
  const unknown = [];
  for (const item of manifest.items) {
    for (const dep of item.registryDependencies || []) {
      if (!names.has(dep)) unknown.push(`${item.name} -> ${dep}`);
    }
  }
  assert.deepEqual(unknown, [], `unknown registry dependencies:\n${unknown.join('\n')}`);
});
