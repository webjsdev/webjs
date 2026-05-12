/**
 * Validates the BUILT registry contents against expected invariants.
 *
 * As of v1 the architecture is two-tier:
 *   - Tier 1 — pure class-helper functions (button, card, badge, alert, …),
 *     they import `cn` from `lib/utils.ts` and export named functions.
 *   - Tier 2 — stateful custom elements (dialog, tabs, popover, …), they
 *     import `Base` + `defineElement` and call `defineElement('ui-…', Class)`.
 *
 * Tests cover both shapes plus a handful of hallmark-class assertions to
 * catch regressions that would silently nuke shadcn-equivalent visuals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const R_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'registry', 'r');
const skip = !existsSync(R_DIR);

// All v1 components — every one of these MUST be present in the built registry
// and follow either the Tier-1 (class-helper) or Tier-2 (custom-element) shape.
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

function read(name) {
  const item = JSON.parse(readFileSync(join(R_DIR, `${name}.json`), 'utf8'));
  return { item, content: item.files?.[0]?.content || '' };
}

test('registry is built (run `node packages/registry/scripts/build.js` if this fails)', { skip }, () => {
  const files = readdirSync(R_DIR).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 55, `expected ≥55 registry JSONs, found ${files.length}`);
});

test('every v1 component has non-empty inlined content', { skip }, () => {
  for (const name of V1_COMPONENTS) {
    const { item } = read(name);
    assert.ok(Array.isArray(item.files), `${name}: files[] missing`);
    for (const file of item.files) {
      assert.ok(file.content && file.content.length > 50, `${name}: ${file.path} content too short`);
    }
  }
});

test('every Tier-2 component imports Base + defineElement from ../lib/utils.ts', { skip }, () => {
  // Tier 1 helpers that are pure class strings (card, separator, skeleton,
  // aspect-ratio, kbd, table, breadcrumb, avatar) don't need cn() and so
  // don't import utils.ts at all — that's fine. Tier 2 always must.
  for (const name of TIER_2) {
    const { content } = read(name);
    assert.match(
      content,
      /from\s+['"]\.\.\/lib\/utils\.ts['"]/,
      `${name}: missing import from '../lib/utils.ts'`,
    );
    assert.match(content, /\bBase\b/, `${name}: not using Base from utils.ts`);
    assert.match(content, /\bdefineElement\b/, `${name}: not using defineElement`);
  }
});

test('Tier-2 components register at least one ui-* element via defineElement', { skip }, () => {
  for (const name of TIER_2) {
    const { content } = read(name);
    assert.match(
      content,
      /defineElement\(['"]ui-[a-z-]+['"]/,
      `${name}: no defineElement('ui-…') call found`,
    );
  }
});

test('Tier-1 components export named class-helper functions ending in *Class', { skip }, () => {
  const tier1 = V1_COMPONENTS.filter((n) => !TIER_2.has(n));
  for (const name of tier1) {
    const { content } = read(name);
    assert.match(
      content,
      /export\s+(?:const|function)\s+\w+Class\b/,
      `${name}: no exported *Class helper function/const`,
    );
  }
});

test('button.json — variant + size class strings are present', { skip }, () => {
  const { content } = read('button');
  // Variant signatures
  assert.match(content, /bg-primary/);
  assert.match(content, /bg-destructive/);
  assert.match(content, /bg-secondary/);
  assert.match(content, /hover:bg-primary\/90/);
  assert.match(content, /hover:underline/);    // link variant
  assert.match(content, /hover:bg-accent/);    // ghost / outline
  // Size signatures
  assert.match(content, /h-9 px-4/);   // default
  assert.match(content, /h-8/);        // sm
  assert.match(content, /h-10/);       // lg
  assert.match(content, /size-9/);     // icon
  assert.match(content, /size-6/);     // icon-xs
});

test('card.json — exposes all 7 subpart class helpers (no custom elements)', { skip }, () => {
  const { content } = read('card');
  for (const fn of ['cardClass', 'cardHeaderClass', 'cardTitleClass', 'cardDescriptionClass', 'cardActionClass', 'cardContentClass', 'cardFooterClass']) {
    assert.match(content, new RegExp(`export\\s+const\\s+${fn}\\b`), `card missing ${fn}`);
  }
});

test('dialog.json — has focus-trap, escape, role wiring', { skip }, () => {
  const { content } = read('dialog');
  // role="dialog" set via setAttribute — match either single-quoted or double-quoted form
  assert.match(content, /'role',\s*'dialog'|"role",\s*"dialog"|role="dialog"/);
  assert.match(content, /aria-modal/);
  assert.match(content, /Escape/);
  assert.match(content, /Tab/);
  assert.match(content, /focusable/i);
  assert.match(content, /defineElement\(['"]ui-dialog['"]/);
});

test('alert-dialog.json — uses alertdialog role, no overlay-click-to-close', { skip }, () => {
  const { content } = read('alert-dialog');
  assert.match(content, /alertdialog/);
  assert.match(content, /No click-to-close/);
});

test('popover.json — positioning helper + side/align/side-offset attrs', { skip }, () => {
  const { content } = read('popover');
  assert.match(content, /positionFloating/);
  assert.match(content, /side/);
  assert.match(content, /align/);
  assert.match(content, /side-offset/);
});

test('tabs.json — exposes Arrow-key navigation + roles', { skip }, () => {
  const { content } = read('tabs');
  assert.match(content, /ArrowLeft|ArrowRight|ArrowDown|ArrowUp/);
  assert.match(content, /tablist/);
  assert.match(content, /'role',\s*'tab'|"role",\s*"tab"/);
});

test('accordion.json — supports single/multiple + collapsible', { skip }, () => {
  const { content } = read('accordion');
  assert.match(content, /'single'|"single"/);
  assert.match(content, /'multiple'|"multiple"/);
  assert.match(content, /collapsible/);
});
