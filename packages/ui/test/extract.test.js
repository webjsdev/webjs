/**
 * The shared ui-kit projector (#983): `registry/extract.js`.
 *
 * One leaf backs both `webjsui view` and the MCP `ui` tool. These assert the
 * projection shape; the MCP drift-guard (packages/mcp/test/mcp.test.mjs) asserts
 * the tool output equals this projector's output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  uiComponent,
  uiInventory,
  extractHelperSignatures,
  extractHelperAxes,
  extractDocHeader,
  renderComponentText,
} from '../src/registry/extract.js';

test('extractHelperSignatures: captures both export const arrow and export function forms', () => {
  const src =
    'export const cardClass = (opts: { size?: S } = {}): string => "x";\n' +
    'export function buttonClass(opts: O = {}): string { return "y"; }\n' +
    'export type CardSize = "sm";\n' +
    'export interface O {}\n';
  const sigs = extractHelperSignatures(src);
  assert.deepEqual(sigs, ['cardClass(opts: { size?: S } = {})', 'buttonClass(opts: O = {})']);
  assert.doesNotMatch(sigs.join(' '), /CardSize|interface/); // types/interfaces excluded
});

test('extractDocHeader: returns the lead prose, drops the @example and tags', () => {
  const src = '/**\n * Button helper.\n *\n * a11y: label icon-only buttons.\n *\n * @example\n * ```html\n * <button></button>\n * ```\n */\nexport const buttonClass = () => "x";';
  const header = extractDocHeader(src);
  assert.match(header, /Button helper/);
  assert.match(header, /a11y: label/);
  assert.doesNotMatch(header, /@example/);
  assert.doesNotMatch(header, /<button>/);
});

test('uiComponent: Tier-1 button projects helper signatures + deps', () => {
  const c = uiComponent('button');
  assert.equal(c.tier, 1);
  assert.equal(c.type, 'registry:ui');
  assert.ok(c.helpers.some((h) => h.startsWith('buttonClass(')));
  assert.ok(c.dependencies.includes('@webjsdev/core'));
});

test('uiComponent: Tier-2 dialog is tier 2 with no helper signatures', () => {
  const c = uiComponent('dialog');
  assert.equal(c.tier, 2);
  assert.deepEqual(c.helpers, []);
});

test('uiComponent: null for a non-ui / unknown name', () => {
  assert.equal(uiComponent('lib-utils'), null);
  assert.equal(uiComponent('does-not-exist'), null);
});

test('uiInventory: one entry per registry:ui component, tier-labelled, sorted', () => {
  const inv = uiInventory();
  assert.equal(inv.length, 63);
  assert.ok(inv.every((c) => c.tier === 1 || c.tier === 2));
  const names = inv.map((c) => c.name);
  assert.deepEqual(names, [...names].sort(), 'inventory is sorted by name');
});

test('renderComponentText: includes tier, helpers, and deps for a Tier-1 component', () => {
  const text = renderComponentText(uiComponent('card'));
  assert.match(text, /# card  \(Tier 1\)/);
  assert.match(text, /Helpers:/);
  assert.match(text, /cardClass/);
  assert.match(text, /npm: @webjsdev\/core/);
});

test('extractHelperAxes: resolves the local-binding shape (button.ts) into variant + size values', () => {
  const src = readFileSync(new URL('../packages/registry/components/button.ts', import.meta.url), 'utf8');
  const axes = extractHelperAxes(src);
  assert.deepEqual(axes.buttonClass.variant, ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']);
  assert.deepEqual(axes.buttonClass.size, ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg']);
});

test('extractHelperAxes: resolves the inline shape (badge.ts) and unions two objects on one axis (switch.ts)', () => {
  const badge = readFileSync(new URL('../packages/registry/components/badge.ts', import.meta.url), 'utf8');
  assert.deepEqual(extractHelperAxes(badge).badgeClass.variant, ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link']);
  const sw = readFileSync(new URL('../packages/registry/components/switch.ts', import.meta.url), 'utf8');
  // TRACK_SIZES[size] and THUMB_SIZES[size] carry the same keys, unioned + deduplicated.
  assert.deepEqual(extractHelperAxes(sw).switchTrackClass.size, ['default', 'sm']);
  const unioned = extractHelperAxes(
    "const A = { default: 'x', big: 'y' } as const;\nconst B = { default: 'z', huge: 'w' } as const;\n" +
    "export function fooClass(opts: { size?: string } = {}) { const size = opts.size ?? 'default'; return [A[size], B[size]].join(' '); }\n",
  );
  assert.deepEqual(unioned.fooClass.size, ['default', 'big', 'huge']);
});

test('extractHelperAxes: a helper matching neither shape yields no axes rather than a wrong list', () => {
  const src = "const BASE = 'rounded-xl border';\nexport const cardClass = (): string => BASE;\n";
  assert.deepEqual(extractHelperAxes(src), {});
  // An object read through an unrelated index (not an option) is not an axis.
  const other = "const MAP = { a: 1, b: 2 };\nexport function fooClass() { const k = compute(); return String(MAP[k]); }\n";
  assert.deepEqual(extractHelperAxes(other), {});
});

test('extractHelperAxes: a comment inside the variant map cannot swallow the object', () => {
  const src = readFileSync(new URL('../packages/registry/components/button.ts', import.meta.url), 'utf8')
    .replace("'icon-lg': 'cn-button-size-icon-lg',", "'icon-lg': 'cn-button-size-icon-lg', // the app's largest icon button\n  none: '', /* don't */");
  assert.deepEqual(extractHelperAxes(src).buttonClass.size, ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg', 'none']);
});

/* -------------------- blocks and charts (#1666, D18) -------------------- */

const {
  uiBlocks, uiBlockIndex, uiBlock, projectBlock, itemKind, primaryCategory, renderBlockText,
} = await import('../src/registry/extract.js');

// A fixed index, so the chart branch is exercised before the kit ships charts.
const INDEX = [
  { name: 'button', type: 'registry:ui', description: 'A button.' },
  { name: 'lib-utils', type: 'registry:lib' },
  { name: 'login-01', type: 'registry:block', categories: ['authentication', 'login'], description: 'A simple login form.' },
  { name: 'chart-area-default', type: 'registry:block', categories: ['chart', 'area'], description: 'An area chart.' },
  { name: 'loose', type: 'registry:block', description: 'No categories.' },
];

test('itemKind: a chart is a block carrying the chart category, a lib or theme is nothing', () => {
  assert.deepEqual(INDEX.map(itemKind), ['ui', null, 'block', 'chart', 'block']);
});

test('primaryCategory: the most specific category, with chart dropped, else other', () => {
  assert.equal(primaryCategory(INDEX[2]), 'login');
  assert.equal(primaryCategory(INDEX[3]), 'area');
  assert.equal(primaryCategory(INDEX[4]), 'other');
});

test('uiBlocks: blocks and charts by default, filtered by type and by any category', () => {
  assert.deepEqual(uiBlocks({}, INDEX).map((b) => b.name), ['chart-area-default', 'login-01', 'loose']);
  assert.deepEqual(uiBlocks({ type: 'chart' }, INDEX).map((b) => b.name), ['chart-area-default']);
  assert.deepEqual(uiBlocks({ type: 'all' }, INDEX).map((b) => b.name), ['button', 'chart-area-default', 'login-01', 'loose']);
  assert.deepEqual(uiBlocks({ category: 'authentication' }, INDEX).map((b) => b.name), ['login-01'], 'a broad category matches too');
  assert.deepEqual(uiBlocks({ type: 'block' }, INDEX)[0], {
    name: 'login-01', type: 'block', categories: ['authentication', 'login'], description: 'A simple login form.',
  }, 'one compact entry, no files');
});

test('uiBlockIndex: name lists grouped by category, blocks apart from charts, no descriptions', () => {
  assert.deepEqual(uiBlockIndex(INDEX), {
    blocks: { login: ['login-01'], other: ['loose'] },
    charts: { area: ['chart-area-default'] },
  });
});

test('uiBlockIndex over the packaged registry lists the authentication blocks', () => {
  const { blocks } = uiBlockIndex();
  assert.deepEqual(blocks.login, ['login-01', 'login-02', 'login-03', 'login-04', 'login-05']);
  assert.deepEqual(blocks.signup, ['signup-01', 'signup-02', 'signup-03', 'signup-04', 'signup-05']);
});

test('uiBlock: the install command and files with targets, sources only on request', () => {
  const b = uiBlock('login-01');
  assert.ok(b);
  assert.equal(b.type, 'block');
  assert.equal(b.install, 'npx @webjsdev/ui add login-01');
  assert.deepEqual(b.files.map((f) => f.target), ['app/login/page.ts', 'components/login-form.ts']);
  assert.ok(b.files.every((f) => f.content === undefined), 'no source by default');
  assert.ok(b.registryDependencies.includes('field'));

  const withSource = uiBlock('login-01', { source: true });
  assert.match(withSource.files[1].content, /export function loginForm/);
  assert.equal(uiBlock('button'), null, 'a component is not a block');
  assert.equal(uiBlock('nope-nope'), null);
});

test('projectBlock: sources are baked, so no cn-* name reaches an agent', () => {
  const item = {
    name: 'x', type: 'registry:block', categories: ['dashboard'],
    files: [{ path: 'blocks/x/page.ts', type: 'registry:page', target: 'app/x/page.ts', content: "const c = 'cn-card flex';\n" }],
  };
  const out = projectBlock(item, { source: true });
  assert.doesNotMatch(out.files[0].content, /cn-card/);
  assert.match(out.files[0].content, /flex/);
  assert.equal(projectBlock({ name: 'b', type: 'registry:ui' }), null);
});

test('renderBlockText: description, install command and targets, then the sources', () => {
  const text = renderBlockText(uiBlock('signup-02', { source: true }));
  assert.match(text, /# signup-02 {2}\(block\)/);
  assert.match(text, /Install: npx @webjsdev\/ui add signup-02/);
  assert.match(text, /^ {2}public\/placeholder\.svg$/m);
  assert.match(text, /# --- components\/signup-form\.ts ---/);
  assert.doesNotMatch(renderBlockText(uiBlock('signup-02')), /# ---/, 'no sources without them');
});
