/**
 * SSR-level ARIA assertions for the Tier-2 components (#1080).
 *
 * WHY THIS LAYER EXISTS. The browser suite in
 * `test/components/browser/ui-a11y.test.js` runs only the CLIENT renderer,
 * which REMOVES an attribute whose hole resolved to null
 * (`render-client.js`, `removeAttribute` on a nullish value). The SERVER
 * renderer does not: it stringifies the value, so `aria-label=${null}` ships
 * `aria-label=""`. So a component that "omits" an attribute via a null hole
 * passes a client-side guard while serving markup that carries the empty
 * attribute, and SSR then disagrees with the hydrated DOM on exactly the ARIA
 * the component is responsible for.
 *
 * That is not hypothetical: it is the bug these tests were added for. Any
 * conditional ARIA has to be BRANCHED into the template, and only an assertion
 * against `renderToString` can tell whether it was.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = join(HERE, '..', 'packages', 'registry', 'components');
const skip = !existsSync(join(COMPONENTS, 'toggle.ts'));

/** Render a template through the SERVER renderer, with components registered. */
async function ssr(load, build) {
  const { renderToString } = await import('@webjsdev/core/server');
  const { html } = await import('@webjsdev/core');
  for (const name of load) await import(join(COMPONENTS, name));
  return renderToString(build(html));
}

test('ui-toggle: a forwarded name lands on the inner button at SSR', { skip }, async () => {
  const out = await ssr(
    ['toggle.ts'],
    (html) => html`<ui-toggle aria-label="Toggle bold"><svg aria-hidden="true"></svg></ui-toggle>`,
  );
  assert.match(out, /<button[^>]*aria-label="Toggle bold"/, 'name is on the button, not just the host');
});

test('ui-toggle: an unlabelled toggle serves NO empty name attributes', { skip }, async () => {
  const out = await ssr(['toggle.ts'], (html) => html`<ui-toggle>Bold</ui-toggle>`);
  // The counterfactual for branching the template: with a single template and
  // null holes, the server emits both of these as empty strings, putting an
  // empty name on the control whose name should come from its slotted text.
  assert.ok(!out.includes('aria-label=""'), `served an empty aria-label: ${out.slice(0, 300)}`);
  assert.ok(
    !out.includes('aria-labelledby=""'),
    `served an empty aria-labelledby (an IDREF list resolving to nothing): ${out.slice(0, 300)}`,
  );
});

test('ui-dropdown-menu-item: a plain item serves no aria-checked at SSR', { skip }, async () => {
  const out = await ssr(
    ['dropdown-menu.ts'],
    (html) => html`<ui-dropdown-menu-item>Profile</ui-dropdown-menu-item>`,
  );
  assert.match(out, /role="menuitem"/, 'it is a plain menuitem');
  // aria-checked is not an allowed attribute on role="menuitem" at all, so an
  // empty one is a defect in the served HTML, not merely untidy.
  assert.ok(!out.includes('aria-checked'), `served aria-checked on a plain menuitem: ${out}`);
  assert.ok(!out.includes('data-state=""'), `served an empty data-state: ${out}`);
});

test('ui-dropdown-menu-item: a checkbox item serves its role + state at SSR', { skip }, async () => {
  const out = await ssr(
    ['dropdown-menu.ts'],
    (html) => html`<ui-dropdown-menu-item type="checkbox" checked>Status</ui-dropdown-menu-item>`,
  );
  assert.match(out, /role="menuitemcheckbox"/, 'checkable role is in the first paint');
  assert.match(out, /aria-checked="true"/, 'and so is the checked state');
});

test('ui-dropdown-menu-item: an unchecked radio item serves aria-checked=false', { skip }, async () => {
  const out = await ssr(
    ['dropdown-menu.ts'],
    (html) => html`<ui-dropdown-menu-item type="radio" value="top">Top</ui-dropdown-menu-item>`,
  );
  assert.match(out, /role="menuitemradio"/);
  assert.match(out, /aria-checked="false"/, 'an explicit false, not an empty value');
});

test('ui-dropdown-menu-group: an unnamed group serves no empty name', { skip }, async () => {
  const out = await ssr(
    ['dropdown-menu.ts'],
    (html) => html`<ui-dropdown-menu-group><span>x</span></ui-dropdown-menu-group>`,
  );
  assert.match(out, /role="group"/);
  assert.ok(!out.includes('aria-label=""'), `served an empty aria-label: ${out}`);
  assert.ok(!out.includes('aria-labelledby=""'), `served an empty aria-labelledby: ${out}`);
});

test('ui-dropdown-menu-group: a named group forwards the name at SSR', { skip }, async () => {
  const out = await ssr(
    ['dropdown-menu.ts'],
    (html) => html`<ui-dropdown-menu-group aria-label="Panel position"><span>x</span></ui-dropdown-menu-group>`,
  );
  assert.match(out, /role="group"[^>]*aria-label="Panel position"/);
});

test('ui-toggle-group-item: disabled state reaches the first paint', { skip }, async () => {
  const out = await ssr(
    ['toggle-group.ts'],
    (html) => html`<ui-toggle-group type="single">
      <ui-toggle-group-item value="a">a</ui-toggle-group-item>
      <ui-toggle-group-item value="b" disabled>b</ui-toggle-group-item>
    </ui-toggle-group>`,
  );
  // aria-disabled is set from render(), which is the only hook SSR runs, so the
  // disabled state must be in the served HTML rather than appearing on hydrate.
  assert.match(out, /aria-disabled="true"/, 'the disabled item is marked before JS loads');
  // ...and the ROLE has to be there too. `aria-pressed` / `aria-disabled` are
  // not global ARIA attributes, so without role="button" the first paint carries
  // attributes that are not allowed on a generic-role element: the same defect
  // class as aria-checked on role="menuitem". The role used to be set only in
  // connectedCallback, which SSR never calls.
  const items = out.match(/<ui-toggle-group-item[^>]*>/g) ?? [];
  assert.ok(items.length >= 2, 'both items rendered');
  for (const tag of items) {
    assert.match(tag, /role="button"/, `served item has no role, so its ARIA is stray: ${tag}`);
    assert.match(tag, /data-slot="toggle-group-item"/, `served item has no data-slot: ${tag}`);
  }
});

// #1245: the dialog-family role moved off the inner content div and onto the
// native <dialog>, so that exactly ONE dialog-family node is exposed in the
// accessibility tree rather than two nested ones (measured over CDP in
// test/e2e/a11y-tree.e2e.mjs). The role is in render(), which is the only hook
// SSR runs, so the FIRST PAINT is where the move has to be visible. These
// assertions are the SSR half of that contract; the tree assertions are the
// half that proves what the platform actually exposes.
test('ui-dialog-content: the role is on the native <dialog> at SSR, not the panel', { skip }, async () => {
  const out = await ssr(
    ['dialog.ts'],
    (html) => html`<ui-dialog-content><h2>Edit profile</h2></ui-dialog-content>`,
  );
  assert.match(
    out,
    /<dialog[^>]*data-slot="dialog-native"[^>]*role="dialog"|<dialog[^>]*role="dialog"[^>]*data-slot="dialog-native"/,
    `the native <dialog> does not carry the role: ${out.slice(0, 400)}`,
  );
  const panel = out.match(/<div[^>]*data-slot="dialog-content"[^>]*>/)?.[0] ?? '';
  assert.ok(panel, 'the content panel rendered');
  assert.ok(!/\brole=/.test(panel), `the inner panel still carries a role, so both are exposed: ${panel}`);
  // A showModal()-opened native dialog is exposed as modal by the platform, so
  // aria-modal on the node that owns the role would be redundant. The e2e
  // asserts the computed `modal` property is still true without it.
  assert.ok(!out.includes('aria-modal'), `served a redundant aria-modal: ${out.slice(0, 400)}`);
});

test('ui-alert-dialog-content: the alertdialog role is on the native <dialog> at SSR', { skip }, async () => {
  const out = await ssr(
    ['alert-dialog.ts'],
    (html) => html`<ui-alert-dialog-content><h2>Are you sure?</h2></ui-alert-dialog-content>`,
  );
  assert.match(
    out,
    /<dialog[^>]*data-slot="alert-dialog-native"[^>]*role="alertdialog"|<dialog[^>]*role="alertdialog"[^>]*data-slot="alert-dialog-native"/,
    `the native <dialog> does not carry the alertdialog role: ${out.slice(0, 400)}`,
  );
  const panel = out.match(/<div[^>]*data-slot="alert-dialog-content"[^>]*>/)?.[0] ?? '';
  assert.ok(panel, 'the content panel rendered');
  assert.ok(!/\brole=/.test(panel), `the inner panel still carries a role, so both are exposed: ${panel}`);
  assert.ok(!out.includes('aria-modal'), `served a redundant aria-modal: ${out.slice(0, 400)}`);
});

// The sonner toast role is deliberately NOT asserted here. `items` is an empty
// instance signal, so a viewport always renders zero toasts server-side and a
// toast's role never reaches the server renderer through markup at all. The
// branch in sonner.ts is still the correct shape (a nullish hole is the
// documented footgun this file exists for), but its observable contract lives
// in the browser suite and in the accessibility-tree e2e.

test('ui-sheet: the native dialog carries role=dialog and the panel its data-side at SSR', { skip }, async () => {
  const out = await ssr(
    ['sheet.ts'],
    (html) => html`<ui-sheet><ui-sheet-content side="left"><h2 data-slot="sheet-title">Filters</h2></ui-sheet-content></ui-sheet>`,
  );
  assert.match(out, /<dialog(?=[^>]*data-slot="sheet-native")(?=[^>]*role="dialog")/, 'the sheet renders its own native dialog with the dialog role');
  assert.match(out, /data-slot="sheet-content"[^>]*data-side="left"/, 'the panel is attached to its side in the first paint');
});

test('ui-dialog: a centred dialog panel serves no data-side at SSR', { skip }, async () => {
  const out = await ssr(['dialog.ts'], (html) => html`<ui-dialog><ui-dialog-content><h2>T</h2></ui-dialog-content></ui-dialog>`);
  assert.doesNotMatch(out, /data-side=/, 'the null side omits the attribute instead of serving data-side=""');
});

test('ui-drawer: the panel serves its vaul direction, a hidden handle and no corner X at SSR', { skip }, async () => {
  const out = await ssr(
    ['drawer.ts'],
    (html) => html`<ui-drawer><ui-drawer-content direction="left"><h2 data-slot="drawer-title">Share</h2></ui-drawer-content></ui-drawer>`,
  );
  assert.match(out, /data-slot="drawer-content"[^>]*data-vaul-drawer-direction="left"/, 'the direction is in the first paint');
  assert.match(out, /data-slot="drawer-handle"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-slot="drawer-handle"/, 'the handle is hidden from assistive technology');
  assert.doesNotMatch(out, /<button[^>]*data-slot="drawer-close"/, 'no corner X is served and then removed');
});

test('ui-sheet: a sheet panel serves no vaul direction at SSR', { skip }, async () => {
  const out = await ssr(['sheet.ts'], (html) => html`<ui-sheet><ui-sheet-content><h2>T</h2></ui-sheet-content></ui-sheet>`);
  assert.doesNotMatch(out, /data-vaul-drawer-direction=/, 'the null direction omits the attribute');
});

test('ui-context-menu: the served parts carry context-menu slots and the menu role, and the region no popup ARIA', { skip }, async () => {
  const out = await ssr(
    ['context-menu.ts'],
    (html) => html`<ui-context-menu><ui-context-menu-trigger><div tabindex="0">Region</div></ui-context-menu-trigger><ui-context-menu-content><ui-context-menu-item>Rename</ui-context-menu-item><ui-context-menu-item type="checkbox" checked>Show</ui-context-menu-item></ui-context-menu-content></ui-context-menu>`,
  );
  assert.match(out, /data-slot="context-menu-content"[^>]*role="menu"|role="menu"[^>]*data-slot="context-menu-content"/, 'the panel is a menu under its own slot');
  assert.match(out, /data-slot="context-menu-item"[^>]*role="menuitem"|role="menuitem"[^>]*data-slot="context-menu-item"/, 'a plain item');
  assert.match(out, /data-slot="context-menu-checkbox-item"/, 'a checkbox item takes the family slot too');
  assert.match(out, /aria-checked="true"/, 'its state is served');
  assert.doesNotMatch(out, /data-slot="dropdown-menu/, 'no dropdown slot names');
  assert.doesNotMatch(out, /aria-haspopup|aria-expanded/, 'a context region is not a menu button');
});

test('ui-menubar: the bar serves role=menubar, each trigger a menuitem button with its popup, and menubar slots', { skip }, async () => {
  const out = await ssr(
    ['menubar.ts'],
    (html) => html`<ui-menubar aria-label="Editor"><ui-menubar-menu><ui-menubar-trigger>File</ui-menubar-trigger><ui-menubar-content><ui-menubar-item>New</ui-menubar-item><ui-menubar-item type="radio" value="a" checked>A</ui-menubar-item></ui-menubar-content></ui-menubar-menu></ui-menubar>`,
  );
  assert.match(out, /data-slot="menubar"[^>]*role="menubar"/, 'the bar is a menubar');
  assert.match(out, /role="menubar"[^>]*aria-label="Editor"/, 'the bar carries its name');
  assert.match(out, /<button[^>]*data-slot="menubar-trigger"[^>]*role="menuitem"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"/, 'the trigger is the focusable menuitem with its popup state');
  assert.match(out, /data-slot="menubar-menu"/, 'each menu takes its own root slot');
  assert.match(out, /data-slot="menubar-content"[^>]*role="menu"|role="menu"[^>]*data-slot="menubar-content"/, 'the panel is a menu');
  assert.match(out, /data-slot="menubar-radio-item"/, 'a radio item takes the family slot');
  assert.match(out, /cn-menubar-radio-item-indicator/, 'the radio indicator is styled apart from the checkbox one');
  assert.doesNotMatch(out, /data-slot="dropdown-menu/, 'no dropdown slot names');
});

test('ui-navigation-menu: a named nav of ul / li, a closed disclosure trigger, a hidden panel and a current-page link at SSR', { skip }, async () => {
  const out = await ssr(
    ['navigation-menu.ts'],
    (html) => html`<ui-navigation-menu><ui-navigation-menu-list><ui-navigation-menu-item><ui-navigation-menu-trigger>Components</ui-navigation-menu-trigger><ui-navigation-menu-content><ui-navigation-menu-link href="/ui/dialog">Dialog</ui-navigation-menu-link></ui-navigation-menu-content></ui-navigation-menu-item><ui-navigation-menu-item><ui-navigation-menu-link href="/docs" active>Docs</ui-navigation-menu-link></ui-navigation-menu-item></ui-navigation-menu-list></ui-navigation-menu>`,
  );
  assert.match(out, /<nav[^>]*data-slot="navigation-menu"[^>]*aria-label="Main"/, 'a nav named Main by default');
  assert.match(out, /data-viewport="true"/, 'the viewport is on by default');
  assert.match(out, /<ul[^>]*data-slot="navigation-menu-list"/, 'the list is a real ul');
  assert.match(out, /<li[^>]*data-slot="navigation-menu-item"/, 'each item is a real li');
  assert.match(out, /<button[^>]*data-slot="navigation-menu-trigger"[^>]*aria-expanded="false"/, 'the trigger is a collapsed disclosure button');
  assert.match(out, /data-slot="navigation-menu-content"[^>]*hidden/, 'a closed panel is hidden in the first paint');
  assert.match(out, /<a[^>]*href="\/docs"[^>]*data-active="true"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/docs"/, 'the active link is a real anchor marked as the current page');
  assert.doesNotMatch(out, /<a[^>]*href="\/ui\/dialog"[^>]*aria-current/, 'an inactive link carries no aria-current');
  assert.doesNotMatch(out, /role="menu/, 'navigation is not an ARIA menu');
});

test('ui-navigation-menu: viewport="false" serves no viewport frame', { skip }, async () => {
  const out = await ssr(
    ['navigation-menu.ts'],
    (html) => html`<ui-navigation-menu viewport="false"><ui-navigation-menu-list></ui-navigation-menu-list></ui-navigation-menu>`,
  );
  assert.match(out, /data-viewport="false"/);
  assert.doesNotMatch(out, /data-slot="navigation-menu-viewport"/);
});
