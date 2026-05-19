/**
 * Validates registry contents against expected invariants.
 *
 * Reads source files directly from `packages/registry/` (no build step
 * anymore, the website composes JSON on demand via _lib/registry.server.ts).
 *
 * v1 architecture is two-tier:
 *   - Tier 1, pure class-helper functions (button, card, badge, alert, …),
 *     they import `cn` from `lib/utils.ts` and export named functions.
 *   - Tier 2, stateful custom elements (dialog, tabs, popover, …), they
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

// All v1 components, every one of these MUST exist in the registry and follow
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

// Components that are Tier 2, must register a custom element.
// popover, accordion, collapsible moved to Tier 1 once their sources
// became pure class helpers on native HTML (Popover API,
// <details>/<summary>). They no longer extend Base or call defineElement.
const TIER_2 = new Set([
  'toggle', 'toggle-group',
  'dialog', 'alert-dialog', 'tooltip', 'hover-card',
  'tabs',
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

test('button : variant + size class strings are present', { skip }, () => {
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

test('card : exposes all 7 subpart class helpers (no custom elements)', { skip }, () => {
  const src = readSource('card');
  for (const fn of ['cardClass', 'cardHeaderClass', 'cardTitleClass', 'cardDescriptionClass', 'cardActionClass', 'cardContentClass', 'cardFooterClass']) {
    assert.match(src, new RegExp(`export\\s+const\\s+${fn}\\b`), `card missing ${fn}`);
  }
});

test('dialog : delegates to native <dialog> for modal behavior', { skip }, () => {
  const src = readSource('dialog');
  assert.match(src, /'role',\s*'dialog'|"role",\s*"dialog"|role="dialog"/);
  assert.match(src, /aria-modal/);
  // Native dialog is what owns Escape, Tab cycling, and focus restoration.
  assert.match(src, /showModal/);
  assert.match(src, /HTMLDialogElement/);
  assert.match(src, /defineElement\(['"]ui-dialog['"]/);
});

test('alert-dialog : uses alertdialog role, no overlay-click-to-close', { skip }, () => {
  const src = readSource('alert-dialog');
  assert.match(src, /alertdialog/);
  assert.match(src, /No click-to-close/);
  // Native Escape close is cancelled via the dialog's `cancel` event.
  assert.match(src, /cancel/);
  assert.match(src, /showModal/);
});

test('popover : tier-1 class helpers + positionFloating utility export', { skip }, () => {
  const src = readSource('popover');
  // No custom element: pure class helpers + a positioning utility for
  // sibling tier-2 components.
  assert.doesNotMatch(src, /defineElement\(/);
  assert.match(src, /export\s+function\s+positionFloating/);
  // Parameterized helper with shadcn parity for side / align / sideOffset / alignOffset.
  assert.match(src, /export\s+function\s+popoverContentClass\s*\(/);
  assert.match(src, /PopoverContentOptions/);
  assert.match(src, /side\??:\s*PopoverSide/);
  assert.match(src, /align\??:\s*PopoverAlign/);
  assert.match(src, /sideOffset/);
  assert.match(src, /alignOffset/);
  // position-area pre-baked classes (Tailwind 4 scanner needs literals).
  assert.match(src, /\[position-area:bottom_span-right\]/);
  assert.match(src, /\[position-area:top_span-left\]/);
  // alignOffset translate classes baked as literals.
  assert.match(src, /translate-x-\[4px\]/);
  assert.match(src, /translate-x-\[-4px\]/);
  assert.match(src, /translate-y-\[4px\]/);
  assert.match(src, /translate-y-\[-4px\]/);
  // popover invoker pattern referenced in the JSDoc.
  assert.match(src, /popovertarget|popover\s+attribute|Popover API/i);
});

test('positionFloating : accepts alignOffset for tier-2 placement', { skip }, () => {
  const src = readSource('popover');
  // The utility consumed by tooltip / hover-card / dropdown-menu must
  // accept alignOffset alongside sideOffset.
  assert.match(src, /alignOffset\??:\s*number/);
});

test('accordion / collapsible : disabled option on trigger class helper', { skip }, () => {
  for (const name of ['accordion', 'collapsible']) {
    const src = readSource(name);
    assert.match(src, /disabled\??:\s*boolean/, `${name}: trigger class missing { disabled } option`);
    assert.match(src, /pointer-events-none/, `${name}: disabled state should include pointer-events-none`);
    assert.match(src, /inert/, `${name}: docs should mention the native inert attribute for full disable`);
  }
});

test('tier-2 components : read align-offset attribute', { skip }, () => {
  for (const name of ['tooltip', 'hover-card', 'dropdown-menu']) {
    const src = readSource(name);
    assert.match(src, /align-offset/, `${name}: should read align-offset attribute`);
    assert.match(src, /alignOffset/, `${name}: should pass alignOffset to positionFloating`);
  }
});

test('tooltip : skip-delay-duration attribute', { skip }, () => {
  const src = readSource('tooltip');
  assert.match(src, /skip-delay-duration/);
  assert.match(src, /lastTooltipHideAt|lastHideAt|skipDelay/i);
});

test('dropdown-menu : typeahead via text-value', { skip }, () => {
  const src = readSource('dropdown-menu');
  assert.match(src, /typeahead/i);
  assert.match(src, /text-value/);
});

test('accordion : tier-1 class helpers on native <details>/<summary>', { skip }, () => {
  const src = readSource('accordion');
  assert.doesNotMatch(src, /defineElement\(/);
  assert.match(src, /<details/);
  assert.match(src, /<summary/);
  // `name="..."` is the exclusive-accordion primitive.
  assert.match(src, /name=/);
  // `type="single"` and `type="multiple"` still documented (parity with shadcn).
  assert.match(src, /'single'|"single"|type="single"/);
  assert.match(src, /'multiple'|"multiple"|type="multiple"/);
  assert.match(src, /collapsible/);
});

test('collapsible : tier-1 class helpers on native <details>/<summary>', { skip }, () => {
  const src = readSource('collapsible');
  assert.doesNotMatch(src, /defineElement\(/);
  assert.match(src, /<details/);
  assert.match(src, /<summary/);
});

test('dropdown-menu / tooltip / hover-card : top-layer via popover attribute', { skip }, () => {
  for (const name of ['dropdown-menu', 'tooltip', 'hover-card']) {
    const src = readSource(name);
    assert.match(src, /popover/i, `${name}: should reference the Popover API`);
    assert.match(src, /showPopover|hidePopover/, `${name}: should call showPopover/hidePopover`);
  }
});

test('tabs : exposes Arrow-key navigation + roles', { skip }, () => {
  const src = readSource('tabs');
  assert.match(src, /ArrowLeft|ArrowRight|ArrowDown|ArrowUp/);
  assert.match(src, /tablist/);
  assert.match(src, /'role',\s*'tab'|"role",\s*"tab"/);
});

test('accordion : supports single/multiple + collapsible', { skip }, () => {
  const src = readSource('accordion');
  assert.match(src, /'single'|"single"/);
  assert.match(src, /'multiple'|"multiple"/);
  assert.match(src, /collapsible/);
});
