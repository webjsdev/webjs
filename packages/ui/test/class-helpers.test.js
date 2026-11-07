/**
 * Unit tests for Tier-1 class-helper functions: pure functions that return
 * Tailwind class strings. No DOM, no browser, no custom-element machinery.
 *
 * These used to live in `test/browser/ui-visual.test.js` and
 * `test/browser/ui-composite.test.js`, where they mounted nonexistent custom
 * elements (`<ui-button>`, `<ui-card>`, …) and failed. After the Tier-1/Tier-2
 * refactor, Tier-1 components are functions: the right test shape is to
 * call them and assert on the returned string. That's all this file does.
 *
 * Tier-2 custom-element tests still live under `test/browser/` because they
 * need real DOM mount + interaction.
 *
 * Node 22+ imports `.ts` natively, so this file imports the registry sources
 * directly with no transpile step.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakedComponentsDir } from './helpers/baked-registry.js';

const SOURCE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages',
  'registry',
  'components',
);

const skip = !existsSync(join(SOURCE_DIR, 'button.ts'));

// The helpers are asserted as an app runs them: baked with the default
// new-york style, since the registry sources are in base form (#1666).
const COMPONENTS_DIR = skip ? SOURCE_DIR : bakedComponentsDir('new-york');

/** Call a value if it's a function, otherwise return it as-is. */
function resolve(v) {
  return typeof v === 'function' ? v() : v;
}

/** Assert a class-helper export is present and returns a non-trivial string. */
function assertHelper(mod, name) {
  assert.ok(name in mod, `${name} not exported`);
  const out = resolve(mod[name]);
  assert.equal(typeof out, 'string', `${name} did not resolve to a string`);
  assert.ok(out.length > 0, `${name} resolved to empty string`);
}

// ---------- button ----------

test('buttonClass: default variant + size', { skip }, async () => {
  const { buttonClass } = await import(join(COMPONENTS_DIR, 'button.ts'));
  const s = buttonClass();
  assert.match(s, /bg-primary/);
  assert.match(s, /text-primary-foreground/);
  assert.match(s, /hover:bg-primary\/90/);
  assert.match(s, /h-9/); // default size
});

test('buttonClass: variant strings', { skip }, async () => {
  const { buttonClass } = await import(join(COMPONENTS_DIR, 'button.ts'));
  assert.match(buttonClass({ variant: 'destructive' }), /bg-destructive/);
  assert.match(buttonClass({ variant: 'secondary' }), /bg-secondary/);
  assert.match(buttonClass({ variant: 'outline' }), /border/);
  assert.match(buttonClass({ variant: 'outline' }), /hover:bg-accent/);
  assert.match(buttonClass({ variant: 'ghost' }), /hover:bg-accent/);
  assert.doesNotMatch(buttonClass({ variant: 'ghost' }), /bg-primary\b/);
  assert.match(buttonClass({ variant: 'link' }), /underline-offset-4/);
});

test('buttonClass: size strings', { skip }, async () => {
  const { buttonClass } = await import(join(COMPONENTS_DIR, 'button.ts'));
  assert.match(buttonClass({ size: 'xs' }), /h-6/);
  assert.match(buttonClass({ size: 'sm' }), /h-8/);
  assert.match(buttonClass({ size: 'lg' }), /h-10/);
  assert.match(buttonClass({ size: 'icon' }), /size-9/);
  assert.match(buttonClass({ size: 'icon-xs' }), /size-6/);
  assert.match(buttonClass({ size: 'icon-sm' }), /size-8/);
  assert.match(buttonClass({ size: 'icon-lg' }), /size-10/);
});

// ---------- badge ----------

test('badgeClass: variants', { skip }, async () => {
  const { badgeClass } = await import(join(COMPONENTS_DIR, 'badge.ts'));
  assert.match(badgeClass(), /bg-primary/);
  assert.match(badgeClass({ variant: 'secondary' }), /bg-secondary/);
  assert.match(badgeClass({ variant: 'destructive' }), /bg-destructive/);
  assert.doesNotMatch(badgeClass({ variant: 'outline' }), /bg-primary\b/);
});

// ---------- alert ----------

test('alert: class helpers expose role + variant', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'alert.ts'));
  assert.match(mod.alertClass(), /relative/);
  assert.match(mod.alertClass({ variant: 'destructive' }), /text-destructive/);
  assertHelper(mod, 'alertTitleClass');
  assertHelper(mod, 'alertDescriptionClass');
});

// ---------- card ----------

test('card: exposes 7 subpart helpers', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'card.ts'));
  for (const name of [
    'cardClass',
    'cardHeaderClass',
    'cardTitleClass',
    'cardDescriptionClass',
    'cardActionClass',
    'cardContentClass',
    'cardFooterClass',
  ]) {
    assertHelper(mod, name);
  }
  assert.match(mod.cardClass(), /rounded-/);
});

// ---------- avatar ----------

test('avatar: exposes 6 subpart helpers', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'avatar.ts'));
  assert.equal(typeof mod.avatarClass, 'function');
  for (const name of [
    'avatarImageClass',
    'avatarFallbackClass',
    'avatarBadgeClass',
    'avatarGroupClass',
    'avatarGroupCountClass',
  ]) {
    assertHelper(mod, name);
  }
});

// ---------- table ----------

test('table: 9 subpart helpers', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'table.ts'));
  for (const name of [
    'tableContainerClass',
    'tableClass',
    'tableHeaderClass',
    'tableBodyClass',
    'tableFooterClass',
    'tableRowClass',
    'tableHeadClass',
    'tableCellClass',
    'tableCaptionClass',
  ]) {
    assertHelper(mod, name);
  }
});

// ---------- input / textarea / label ----------

test('input / textarea / label: helper strings', { skip }, async () => {
  const input = await import(join(COMPONENTS_DIR, 'input.ts'));
  const textarea = await import(join(COMPONENTS_DIR, 'textarea.ts'));
  const label = await import(join(COMPONENTS_DIR, 'label.ts'));
  assert.match(input.inputClass(), /border/);
  assert.match(textarea.textareaClass(), /border/);
  assert.match(label.labelClass(), /text-sm/);
});

// ---------- visual primitives ----------

test('separator / skeleton / aspect-ratio / kbd: helpers exist', { skip }, async () => {
  const sep = await import(join(COMPONENTS_DIR, 'separator.ts'));
  const skel = await import(join(COMPONENTS_DIR, 'skeleton.ts'));
  const ar = await import(join(COMPONENTS_DIR, 'aspect-ratio.ts'));
  const kbd = await import(join(COMPONENTS_DIR, 'kbd.ts'));

  // separator is a function (takes orientation)
  assert.match(sep.separatorClass(), /shrink-0/);
  assert.match(sep.separatorClass({ orientation: 'vertical' }), /h-full|w-px/);

  assert.match(skel.skeletonClass(), /animate-pulse/);
  assert.match(ar.aspectRatioClass(), /relative/);
  assertHelper(kbd, 'kbdClass');
  assertHelper(kbd, 'kbdGroupClass');
});

// ---------- form primitives that are class helpers (no <ui-*>) ----------

test('checkbox / switch / radio-group / toggle: class helpers (not custom elements)', { skip }, async () => {
  const cb = await import(join(COMPONENTS_DIR, 'checkbox.ts'));
  const sw = await import(join(COMPONENTS_DIR, 'switch.ts'));
  const rg = await import(join(COMPONENTS_DIR, 'radio-group.ts'));
  const tg = await import(join(COMPONENTS_DIR, 'toggle.ts'));

  assert.equal(typeof cb.checkboxClass, 'function');
  assert.equal(typeof sw.switchInputClass, 'function');
  assert.equal(typeof sw.switchTrackClass, 'function');
  assertHelper(rg, 'radioGroupClass');
  assertHelper(rg, 'radioClass');
  assert.equal(typeof tg.toggleClass, 'function');
});

test('toggle: variant + size accepted', { skip }, async () => {
  const { toggleClass } = await import(join(COMPONENTS_DIR, 'toggle.ts'));
  assert.ok(toggleClass().length > 10);
  assert.match(toggleClass({ variant: 'outline' }), /border/);
});

test('progress: progressClass over native <progress>', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'progress.ts'));
  assertHelper(mod, 'progressClass');
  // Both vendor pseudo-elements styled for the bar fill.
  assert.match(mod.progressClass(), /\[&::-webkit-progress-value\]:bg-primary/);
  assert.match(mod.progressClass(), /\[&::-moz-progress-bar\]:bg-primary/);
  // Module exports the class helper only, no custom-element side effects.
  assert.equal(mod.UiProgress, undefined, 'UiProgress class no longer exported');
});

// ---------- breadcrumb / pagination ----------

test('breadcrumb: 6 subpart helpers', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'breadcrumb.ts'));
  for (const name of [
    'breadcrumbListClass',
    'breadcrumbItemClass',
    'breadcrumbLinkClass',
    'breadcrumbPageClass',
    'breadcrumbSeparatorClass',
    'breadcrumbEllipsisClass',
  ]) {
    assertHelper(mod, name);
  }
});

test('pagination: helpers including variant-driven link', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'pagination.ts'));
  assert.equal(typeof mod.paginationLinkClass, 'function');
  const active = mod.paginationLinkClass({ isActive: true });
  const inactive = mod.paginationLinkClass({ isActive: false });
  assert.notEqual(active, inactive, 'active variant differs from inactive');
});

// ---------- native-select ----------

test('native-select: wrapper + select + option helpers', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'native-select.ts'));
  for (const name of [
    'nativeSelectWrapperClass',
    'nativeSelectClass',
    'nativeSelectIconClass',
    'nativeSelectOptionClass',
    'nativeSelectOptGroupClass',
  ]) {
    assertHelper(mod, name);
  }
});

// ---------- empty ----------

test('empty: 6 subpart helpers, icon media variant', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'empty.ts'));
  for (const name of [
    'emptyClass',
    'emptyHeaderClass',
    'emptyMediaClass',
    'emptyTitleClass',
    'emptyDescriptionClass',
    'emptyContentClass',
  ]) assertHelper(mod, name);
  assert.match(mod.emptyClass(), /border-dashed/);
  assert.match(mod.emptyClass(), /md:p-12/);
  assert.match(mod.emptyHeaderClass(), /max-w-sm/);
  assert.match(mod.emptyMediaClass(), /bg-transparent/);
  const icon = mod.emptyMediaClass({ variant: 'icon' });
  assert.match(icon, /size-10/);
  assert.match(icon, /rounded-lg/);
  assert.match(icon, /bg-muted/);
  assert.match(icon, /text-foreground/);
  assert.doesNotMatch(icon, /bg-transparent/);
  assert.match(mod.emptyDescriptionClass(), /text-muted-foreground/);
});

// ---------- spinner ----------

test('spinner: spinnerClass + an inline SVG that SSRs as a named status', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'spinner.ts'));
  assert.equal(mod.spinnerClass(), 'size-4 animate-spin');
  const { renderToString } = await import('@webjsdev/core/server');
  const out = await renderToString(mod.spinner());
  assert.match(out, /<svg[^>]*role="status"/);
  assert.match(out, /aria-label="Loading"/);
  assert.match(out, /stroke="currentColor"/);
  assert.match(out, /class="size-4 animate-spin"/);
  assert.match(out, /M21 12a9 9 0 1 1-6\.219-8\.56/);
});

test('spinner: a size class replaces the default, label renames it', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'spinner.ts'));
  const { renderToString } = await import('@webjsdev/core/server');
  const out = await renderToString(mod.spinner({ class: 'size-6', label: 'Saving' }));
  assert.match(out, /class="animate-spin size-6"|class="size-6 animate-spin"/);
  assert.doesNotMatch(out, /size-4/);
  assert.match(out, /aria-label="Saving"/);
});

test('spinner: decorative serves aria-hidden and NO empty role or name', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'spinner.ts'));
  const { renderToString } = await import('@webjsdev/core/server');
  const out = await renderToString(mod.spinner({ decorative: true }));
  assert.match(out, /aria-hidden="true"/);
  assert.doesNotMatch(out, /role=/);
  assert.doesNotMatch(out, /aria-label=/);
});

// ---------- field ----------

test('field: 11 subpart helpers with orientation + legend variants', { skip }, async () => {
  const mod = await import(join(COMPONENTS_DIR, 'field.ts'));
  for (const name of [
    'fieldSetClass',
    'fieldLegendClass',
    'fieldGroupClass',
    'fieldClass',
    'fieldContentClass',
    'fieldLabelClass',
    'fieldTitleClass',
    'fieldDescriptionClass',
    'fieldErrorClass',
    'fieldSeparatorClass',
    'fieldSeparatorContentClass',
  ]) assertHelper(mod, name);
  assert.match(mod.fieldClass(), /group\/field/);
  assert.match(mod.fieldClass(), /data-\[invalid=true\]:text-destructive/);
  assert.match(mod.fieldClass(), /flex-col/);
  assert.match(mod.fieldClass({ orientation: 'horizontal' }), /flex-row items-center/);
  assert.match(mod.fieldClass({ orientation: 'responsive' }), /@md\/field-group:flex-row/);
  assert.match(mod.fieldLegendClass(), /text-base/);
  assert.match(mod.fieldLegendClass({ variant: 'label' }), /text-sm/);
  assert.match(mod.fieldGroupClass(), /@container\/field-group/);
  assert.match(mod.fieldErrorClass(), /text-destructive/);
  assert.match(mod.fieldErrorClass(), /text-sm/);
  assert.match(mod.fieldLabelClass(), /group-data-\[disabled=true\]\/field:opacity-50/);
  assert.match(mod.fieldDescriptionClass(), /text-muted-foreground/);
});

// ---------- shadcn's style-function names (#1666, D9) ----------

test('the shadcn style-function aliases return the helper output, plus a merged className', { skip }, async () => {
  const pairs = [
    ['button.ts', 'buttonVariants', 'buttonClass', { variant: 'outline', size: 'sm' }],
    ['badge.ts', 'badgeVariants', 'badgeClass', { variant: 'secondary' }],
    ['toggle.ts', 'toggleVariants', 'toggleClass', { variant: 'outline', size: 'lg' }],
    ['tabs.ts', 'tabsListVariants', 'tabsListClass', { variant: 'underline' }],
  ];
  for (const [file, alias, helper, opts] of pairs) {
    const mod = await import(join(COMPONENTS_DIR, file));
    assert.equal(typeof mod[alias], 'function', `${alias} is exported`);
    assert.equal(mod[alias](opts), mod[helper](opts), `${alias} matches ${helper}`);
    assert.match(mod[alias]({ ...opts, className: 'rounded-full' }), /(^|\s)rounded-full(\s|$)/, `${alias} merges className`);
  }
});

test('alertDialogMediaClass: the header media slot', { skip }, async () => {
  const { alertDialogMediaClass } = await import(join(COMPONENTS_DIR, 'alert-dialog.ts'));
  const s = alertDialogMediaClass();
  assert.match(s, /size-16/);
  assert.match(s, /bg-muted/);
  assert.doesNotMatch(s, /(^|\s)cn-/, 'baked, no cn-* name');
});

// ---------- base form keeps shadcn's inline utilities (#1666) ----------
// These read the BASE-FORM source, not a baked copy: a utility shadcn keeps
// inline must be inline here too, or a style that does not map it (every
// shadcn style but the kit's new-york) draws the part without it.

const baseHelpers = (name) => import(join(SOURCE_DIR, `${name}.ts`));
const tokens = (s) => s.split(/\s+/);

test('avatar: the image lies over the fallback, so only one of them shows', { skip }, async () => {
  const { avatarClass, avatarImageClass } = await baseHelpers('avatar');
  assert.ok(tokens(avatarClass()).includes('relative'), 'the root positions the image');
  for (const t of ['absolute', 'inset-0', 'object-cover']) assert.ok(tokens(avatarImageClass()).includes(t), `the image carries ${t}`);
});

test('avatar: the badge sizes itself from the avatar size in base form', { skip }, async () => {
  const { avatarBadgeClass } = await baseHelpers('avatar');
  for (const t of ['group-data-[size=sm]/avatar:size-2', 'group-data-[size=default]/avatar:size-2.5', 'group-data-[size=lg]/avatar:size-3']) {
    assert.ok(tokens(avatarBadgeClass()).includes(t), t);
  }
});

test('separator: shadcn\'s inline size and colour are kept inline', { skip }, async () => {
  const { separatorClass } = await baseHelpers('separator');
  for (const t of ['shrink-0', 'bg-border', 'data-horizontal:h-px', 'data-horizontal:w-full', 'data-vertical:w-px', 'data-vertical:self-stretch']) {
    assert.ok(tokens(separatorClass()).includes(t), t);
  }
});

test('field separator: the rule is drawn in base form, not only by new-york', { skip }, async () => {
  const { fieldSeparatorClass } = await baseHelpers('field');
  for (const t of ['before:absolute', 'before:top-1/2', 'before:h-px', 'before:bg-border']) assert.ok(tokens(fieldSeparatorClass()).includes(t), t);
});

test('field: the field carries cn-field, which the styles space', { skip }, async () => {
  const { fieldClass } = await baseHelpers('field');
  assert.ok(tokens(fieldClass()).includes('cn-field'));
  assert.ok(tokens(fieldClass()).includes('*:w-full'), 'a vertical field widens its controls in base form');
});

test('accordion: accordionContentInnerClass is shadcn\'s inner content wrapper', { skip }, async () => {
  const { accordionContentInnerClass, accordionClass } = await baseHelpers('accordion');
  const inner = tokens(accordionContentInnerClass());
  assert.ok(inner.includes('cn-accordion-content-inner'));
  assert.ok(inner.includes('[&_a]:underline'));
  assert.ok(inner.includes('[&_p:not(:last-child)]:mb-4'));
  assert.ok(tokens(accordionClass()).includes('flex') && tokens(accordionClass()).includes('flex-col'));
});
