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

// #1697: an eval agent wrote `buttonClass({ variant: 'link', className })`,
// the shadcn `buttonVariants` habit under the kit's own name, and spent a
// typecheck round on it. Every helper that has a shadcn alias takes it too.
test('a helper with a shadcn alias takes className itself, and is unchanged without it', { skip }, async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const files = readdirSync(COMPONENTS_DIR).filter((f) => f.endsWith('.ts'));
  let checked = 0;
  for (const file of files) {
    const src = readFileSync(join(COMPONENTS_DIR, file), 'utf8');
    const mod = await import(join(COMPONENTS_DIR, file));
    for (const [, base] of src.matchAll(/export function ([a-zA-Z]+)Variants\(/g)) {
      const helper = mod[`${base}Class`];
      assert.equal(typeof helper, 'function', `${base}Class is exported beside ${base}Variants`);
      const plain = helper();
      assert.equal(helper({ className: '' }), plain, `${base}Class with an empty className is unchanged`);
      assert.match(helper({ className: 'wj-extra' }), /(^|\s)wj-extra(\s|$)/, `${base}Class merges className`);
      assert.equal(helper({ className: 'wj-extra' }), mod[`${base}Variants`]({ className: 'wj-extra' }), `${base}Class matches its alias`);
      checked += 1;
    }
  }
  assert.ok(checked >= 17, `checked ${checked} helpers`);
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

// ---------- review batch 2 (#1666) ----------

test('calendar: the caption dropdown box and label carry names only new-york styles', { skip }, async () => {
  const { calendarDropdownRootClass, calendarCaptionLabelClass } = await baseHelpers('calendar');
  // shadcn's build leaves cn-calendar-dropdown-root / -caption-label unstyled,
  // so ui.shadcn.com draws no border in any style. The kit's names are mapped
  // by new-york alone.
  assert.ok(!tokens(calendarDropdownRootClass()).includes('cn-calendar-dropdown-root'));
  assert.ok(!tokens(calendarCaptionLabelClass()).includes('cn-calendar-caption-label'));
  assert.ok(tokens(calendarDropdownRootClass()).includes('cn-calendar-dropdown-box'));
});

test('collapsible: the trigger keeps only its summary resets inline, so a merged button keeps its size', { skip }, async () => {
  const { collapsibleTriggerClass } = await baseHelpers('collapsible');
  const t = tokens(collapsibleTriggerClass());
  for (const c of ['w-full', 'text-sm', 'rounded-md', 'gap-2']) assert.ok(!t.includes(c), `no inline ${c}`);
  assert.ok(t.includes('list-none') && t.includes('[&::-webkit-details-marker]:hidden'));
});

test('item: the separator draws a line in every style; alert: alertActionClass; field: the label is a Label', { skip }, async () => {
  const { itemSeparatorClass } = await baseHelpers('item');
  for (const c of ['h-px', 'w-full', 'bg-border']) assert.ok(tokens(itemSeparatorClass()).includes(c), c);
  const { alertActionClass } = await baseHelpers('alert');
  assert.equal(alertActionClass(), 'cn-alert-action');
  const { fieldLabelClass } = await baseHelpers('field');
  assert.ok(tokens(fieldLabelClass()).includes('cn-label'), 'shadcn FieldLabel renders a Label');
});

test('popover: a negative alignOffset shifts the other way rather than dropping', { skip }, async () => {
  const { popoverContentClass } = await baseHelpers('popover');
  assert.match(popoverContentClass({ side: 'bottom', align: 'start', alignOffset: -4 }), /translate-x-\[-4px\]/);
  assert.match(popoverContentClass({ side: 'bottom', align: 'end', alignOffset: -8 }), /translate-x-\[8px\]/);
  assert.match(popoverContentClass({ side: 'right', align: 'start', alignOffset: 4 }), /translate-y-\[4px\]/);
});

test('new-york: the <ui-switch> thumb draws itself, and the sidebar trigger is size-7', { skip }, async () => {
  const { readFileSync } = await import('node:fs');
  const sw = readFileSync(join(COMPONENTS_DIR, 'switch.ts'), 'utf8');
  assert.match(sw, /size-4 rounded-full bg-background[^']*after:hidden/, 'the real thumb has a size in new-york, and hides the plain-markup pseudo-element');
  const sb = readFileSync(join(COMPONENTS_DIR, 'sidebar.ts'), 'utf8');
  assert.match(sb, /'size-7'|\bsize-7\b/, 'new-york sizes the trigger as shadcn new-york does');
});

test('spinner: data-icon is passed through, and the table head aligns to the logical start', { skip }, async () => {
  const { renderToString } = await import('@webjsdev/core/server');
  const { spinner } = await baseHelpers('spinner');
  assert.match(await renderToString(spinner({ icon: 'inline-start' })), /data-icon="inline-start"/);
  assert.doesNotMatch(await renderToString(spinner()), /data-icon/, 'left out, no attribute');
  assert.match(await renderToString(spinner({ decorative: true, icon: 'inline-end' })), /data-icon="inline-end"/);
  const { tableHeadClass } = await baseHelpers('table');
  assert.ok(tokens(tableHeadClass()).includes('text-start'), 'text-start, not the styles\' text-left, so RTL works');
});

test('new-york: a card defines --card-spacing, and an input group stacks around a block addon', { skip }, async () => {
  const { cardClass } = await import(join(COMPONENTS_DIR, 'card.ts'));
  const card = tokens(cardClass());
  assert.ok(card.includes('[--card-spacing:--spacing(6)]'), 'the padding a block reads for its own content');
  assert.ok(card.includes('data-[size=sm]:[--card-spacing:--spacing(4)]'));
  const { inputGroupClass } = await import(join(COMPONENTS_DIR, 'input-group.ts'));
  const group = tokens(inputGroupClass());
  for (const c of ['has-[>[data-align=block-end]]:flex-col', 'has-[>[data-align=block-end]]:h-auto', 'has-[>[data-align=block-start]]:flex-col']) {
    assert.ok(group.includes(c), c);
  }
});
