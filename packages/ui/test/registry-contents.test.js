/**
 * Validates registry contents against expected invariants.
 *
 * Reads source files directly from `packages/registry/` (no build step
 * anymore — the website composes JSON on demand via _lib/registry.server.ts).
 *
 * v1 architecture is two-tier:
 *   - Tier 1 — pure class-helper functions (button, card, badge, alert, …),
 *     they import `cn` from `lib/utils.ts` and export named functions.
 *   - Tier 2 — stateful custom elements (dialog, tabs, popover, …), they
 *     import `Base` + `defineElement` and call `defineElement('ui-…', Class)`.
 *
 * Tests cover both shapes plus hallmark-class assertions to catch regressions
 * that would silently nuke the expected visual output (variant classes,
 * size classes, data-state attribute wiring).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry');
const COMPONENTS_DIR = join(REGISTRY_DIR, 'components');
const MANIFEST_PATH = join(REGISTRY_DIR, 'registry.json');

const skip = !existsSync(MANIFEST_PATH);

// All v1 components — every one of these MUST exist in the registry and follow
// either the Tier-1 (class-helper) or Tier-2 (custom-element) shape.
const V1_COMPONENTS = [
  'button', 'badge', 'alert', 'card',
  'input', 'textarea', 'label',
  'checkbox', 'switch', 'radio-group', 'native-select',
  'avatar', 'separator', 'skeleton', 'aspect-ratio', 'kbd',
  'table', 'toggle', 'breadcrumb', 'pagination',
  'progress', 'toggle-group',
  'dialog', 'alert-dialog', 'popover', 'tooltip', 'hover-card',
  'tabs', 'accordion', 'collapsible',
  'dropdown-menu', 'sonner',
];

// Components that are Tier 2 — must register a custom element.
const TIER_2 = new Set([
  'progress', 'toggle', 'toggle-group',
  'dialog', 'alert-dialog', 'popover', 'tooltip', 'hover-card',
  'tabs', 'accordion', 'collapsible',
  'dropdown-menu', 'sonner',
]);

function readSource(name) {
  return readFileSync(join(COMPONENTS_DIR, `${name}.ts`), 'utf8');
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

test('registry.json exists and enumerates ≥32 v1 components', { skip }, () => {
  const m = readManifest();
  const uiItems = m.items.filter((it) => it.type === 'registry:ui');
  assert.ok(uiItems.length >= 32, `expected ≥32 registry:ui items, found ${uiItems.length}`);
});

test('every v1 component source file exists and is non-trivial', { skip }, () => {
  for (const name of V1_COMPONENTS) {
    const src = readSource(name);
    assert.ok(src.length > 200, `${name}: source too short`);
  }
});

test('every v1 component is declared in registry.json', { skip }, () => {
  const m = readManifest();
  const names = new Set(m.items.map((it) => it.name));
  for (const name of V1_COMPONENTS) {
    assert.ok(names.has(name), `${name}: missing from registry.json`);
  }
});

test('every Tier-2 component imports Base + defineElement from ../lib/utils.ts', { skip }, () => {
  for (const name of TIER_2) {
    const src = readSource(name);
    assert.match(
      src,
      /from\s+['"]\.\.\/lib\/utils\.ts['"]/,
      `${name}: missing import from '../lib/utils.ts'`,
    );
    assert.match(src, /\bBase\b/, `${name}: not using Base from utils.ts`);
    assert.match(src, /\bdefineElement\b/, `${name}: not using defineElement`);
  }
});

test('Tier-2 components register at least one ui-* element via defineElement', { skip }, () => {
  for (const name of TIER_2) {
    const src = readSource(name);
    assert.match(
      src,
      /defineElement\(['"]ui-[a-z-]+['"]/,
      `${name}: no defineElement('ui-…') call found`,
    );
  }
});

test('Tier-1 components export named class-helper functions ending in *Class', { skip }, () => {
  const tier1 = V1_COMPONENTS.filter((n) => !TIER_2.has(n));
  for (const name of tier1) {
    const src = readSource(name);
    assert.match(
      src,
      /export\s+(?:const|function)\s+\w+Class\b/,
      `${name}: no exported *Class helper function/const`,
    );
  }
});

test('button — variant + size class strings are present', { skip }, () => {
  const src = readSource('button');
  assert.match(src, /bg-primary/);
  assert.match(src, /bg-destructive/);
  assert.match(src, /bg-secondary/);
  assert.match(src, /hover:bg-primary\/90/);
  assert.match(src, /hover:underline/);    // link variant
  assert.match(src, /hover:bg-accent/);    // ghost / outline
  assert.match(src, /h-9 px-4/);   // default
  assert.match(src, /h-8/);        // sm
  assert.match(src, /h-10/);       // lg
  assert.match(src, /size-9/);     // icon
  assert.match(src, /size-6/);     // icon-xs
});

test('card — exposes all 7 subpart class helpers (no custom elements)', { skip }, () => {
  const src = readSource('card');
  for (const fn of ['cardClass', 'cardHeaderClass', 'cardTitleClass', 'cardDescriptionClass', 'cardActionClass', 'cardContentClass', 'cardFooterClass']) {
    assert.match(src, new RegExp(`export\\s+const\\s+${fn}\\b`), `card missing ${fn}`);
  }
});

test('dialog — has focus-trap, escape, role wiring', { skip }, () => {
  const src = readSource('dialog');
  assert.match(src, /'role',\s*'dialog'|"role",\s*"dialog"|role="dialog"/);
  assert.match(src, /aria-modal/);
  assert.match(src, /Escape/);
  assert.match(src, /Tab/);
  assert.match(src, /focusable/i);
  assert.match(src, /defineElement\(['"]ui-dialog['"]/);
});

test('alert-dialog — uses alertdialog role, no overlay-click-to-close', { skip }, () => {
  const src = readSource('alert-dialog');
  assert.match(src, /alertdialog/);
  assert.match(src, /No click-to-close/);
});

test('popover — positioning helper + side/align/side-offset attrs', { skip }, () => {
  const src = readSource('popover');
  assert.match(src, /positionFloating/);
  assert.match(src, /side/);
  assert.match(src, /align/);
  assert.match(src, /side-offset/);
});

test('tabs — exposes Arrow-key navigation + roles', { skip }, () => {
  const src = readSource('tabs');
  assert.match(src, /ArrowLeft|ArrowRight|ArrowDown|ArrowUp/);
  assert.match(src, /tablist/);
  assert.match(src, /'role',\s*'tab'|"role",\s*"tab"/);
});

test('accordion — supports single/multiple + collapsible', { skip }, () => {
  const src = readSource('accordion');
  assert.match(src, /'single'|"single"/);
  assert.match(src, /'multiple'|"multiple"/);
  assert.match(src, /collapsible/);
});
