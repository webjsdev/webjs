/**
 * Which kit stylesheets a /ui page links (#1666). Every kit style is its own
 * sheet in public/ui-styles/ and public/ui.css carries none, so a region in a
 * style the page does not link renders unstyled. The page-wide test renders
 * every /ui page listUiPages names, plus the bare frames, and holds each
 * `.style-<name>` wrapper it renders to a link for that style's sheet.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { stylesFor } from '#lib/ui/style-links.ts';
import { listUiPages } from '#lib/ui/llm.server.ts';
import { styleSheetHref } from '#modules/ui/create/design-system.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

test('the AI Elements patterns and the helper pages link rhea over the chrome\'s new-york', () => {
  assert.deepEqual(stylesFor('/ui/docs/ai-elements/chat'), ['new-york', 'rhea']);
  assert.deepEqual(stylesFor('/ui/docs/ai-elements/prompt-input/'), ['new-york', 'rhea']);
  assert.deepEqual(stylesFor('/ui/docs/helpers/ai-sdk'), ['new-york', 'rhea']);
});

test('a page links only the styles it renders', () => {
  assert.deepEqual(stylesFor('/ui/docs/ai-elements'), ['new-york'], 'the AI Elements index has no preview');
  assert.deepEqual(stylesFor('/ui/docs'), ['new-york'], 'a page with no preview carries no nova');
  assert.deepEqual(stylesFor('/ui/docs/components/button'), ['new-york', 'nova'], 'the docs previews are nova');
  assert.deepEqual(stylesFor('/ui/docs/components/trace'), ['new-york', 'rhea'], 'a component page with no nova preview carries none, only its lead style');
  assert.deepEqual(stylesFor('/ui/view/dashboard-01'), ['new-york'], 'a block frame is new-york alone');
  assert.deepEqual(stylesFor('/ui/view/sidebar-rtl'), ['nova'], 'the full-screen docs demo is nova alone');
  assert.deepEqual(stylesFor('/ui/preview/preview'), ['nova'], 'the configurator frame renders its default style');
  assert.deepEqual(stylesFor('/ui/preview/preview', new URLSearchParams('style=lyra')), ['lyra'], 'or the one its query names');
  assert.deepEqual(stylesFor('/ui/preview/typeset/chat'), [], 'the typeset frame renders none');
});

test('the home and section pages keep their styles', () => {
  assert.deepEqual(stylesFor('/ui'), ['luma', 'new-york', 'rhea']);
  assert.deepEqual(stylesFor('/ui/blocks/sidebar'), ['luma', 'new-york']);
  assert.deepEqual(stylesFor('/ui/colors'), ['luma', 'new-york']);
  assert.deepEqual(stylesFor('/ui/sera'), ['new-york', 'sera']);
});

test('ui.css carries no kit style; each is its own sheet', async () => {
  const ui = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-input.css'), 'utf8');
  assert.doesNotMatch(ui, /scoped\/style-[a-z-]+\.css/, 'ui-input.css imports no style');
  // The build compiles every style the registry lists, the two the chrome
  // and the docs render included, and the configurator links only those.
  const { STYLE_NAMES } = await import('../../scripts/scope-ui-styles.mjs');
  for (const name of ['new-york', 'nova']) assert.ok(STYLE_NAMES.includes(name), `the build compiles ${name}`);
  assert.equal(styleSheetHref('nova'), '/public/ui-styles/nova.css');
  assert.equal(styleSheetHref('not-a-style'), null, 'a name nothing builds gets no sheet');
});

test('every kit sheet regenerates in dev when its sources change', async () => {
  // webjs.dev.regenerate is keyed by the requested output path, so a sheet
  // with no rule of its own is served stale after a style edit in dev.
  const { STYLE_NAMES } = await import('../../scripts/scope-ui-styles.mjs');
  const pkg = JSON.parse(readFileSync(resolve(WEBSITE_ROOT, 'package.json'), 'utf8'));
  const rules: { output: string; command: string; inputs: string[] }[] = pkg.webjs.dev.regenerate;
  for (const name of STYLE_NAMES) {
    const rule = rules.find((r) => r.output === `public/ui-styles/${name}.css`);
    assert.ok(rule, `${name}.css has a regenerate rule`);
    assert.ok(rule.command.endsWith(` ${name}`), `and it rebuilds ${name} alone`);
    assert.ok(rule.inputs.includes('../packages/ui/packages/registry/styles'), 'from the registry styles');
  }
  const ui = rules.find((r) => r.output === 'public/ui.css');
  assert.ok(ui && !ui.inputs.includes('../packages/ui/packages/registry/styles'), 'ui.css no longer rebuilds on a kit style edit');
});

/** The pathnames to render: every /ui page, and the frames pages embed. */
async function uiPaths(): Promise<string[]> {
  const pages = await listUiPages('http://localhost');
  const paths = new Set(pages.map((p) => p.path));
  // Every registry block, the charts included, as the block pages frame them.
  const registry = JSON.parse(readFileSync(resolve(WEBSITE_ROOT, '../packages/ui/packages/registry/registry.json'), 'utf8')) as { items: { name: string; type: string }[] };
  for (const item of registry.items) if (item.type === 'registry:block') paths.add(`/ui/view/${item.name}`);
  for (const n of ['preview', 'preview-02', 'preview-03']) { paths.add(`/ui/preview/${n}`); paths.add(`/ui/view/${n}`); }
  // The configurator frame in a style its query names, and the one docs demo
  // a frame serves whole.
  paths.add('/ui/preview/preview?style=lyra');
  paths.add('/ui/view/sidebar-rtl');
  for (const f of readdirSync(resolve(WEBSITE_ROOT, 'modules/ui/typeset/fixtures'))) {
    const m = /^([a-z0-9-]+)\.(?:server\.)?ts$/.exec(f);
    if (m && m[1] !== 'index') paths.add(`/ui/preview/typeset/${m[1]}`);
  }
  return [...paths].sort();
}

/** The kit styles named by `.style-<name>` classes in a chunk of markup. */
function wrappers(html: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      const s = /^style-([a-z]+(?:-[a-z]+)*)$/.exec(c);
      if (s) out.add(s[1]);
    }
  }
  return out;
}

/** The kit styles a chunk of markup links. */
function linked(html: string): Set<string> {
  return new Set([...html.matchAll(/<link rel="stylesheet" href="\/public\/ui-styles\/([a-z-]+)\.css/g)].map((m) => m[1]));
}

/**
 * The block frames that answer 404: the chart blocks are in the registry but
 * render on /ui/charts, not as frames of their own.
 */
const EXPECTED_MISSING = /^\/ui\/view\/chart-/;

test('every /ui page and frame links the sheet of every style it renders', async () => {
  const paths = await uiPaths();
  assert.ok(paths.length > 200, `the page list is the whole section (${paths.length})`);
  const problems: string[] = [];
  let rendered = 0;
  for (const path of paths) {
    const res = await handle(path);
    if (res.status !== 200) {
      // Every page is checked: anything else that does not render is a failure.
      if (!(res.status === 404 && EXPECTED_MISSING.test(path))) problems.push(`${path}: answered ${res.status}`);
      continue;
    }
    rendered++;
    const html = await res.text();
    const split = html.indexOf('</head>');
    const head = linked(html.slice(0, split));
    const body = html.slice(split);
    const used = wrappers(body);
    const frame = path.startsWith('/ui/preview/') || path.startsWith('/ui/view/');
    for (const style of used) {
      // <head> is the only place a stylesheet reliably blocks rendering
      // (#406). A page links its styles first in its own markup and the
      // framework hoists them there, owned by the boundary that linked them,
      // so a soft navigation's response carries them in <head> too and the
      // router switches them off when that boundary is replaced (#1669).
      if (!head.has(style)) problems.push(`${path}: renders .style-${style} and has no ${style}.css in <head>`);
      else if (!new RegExp(`href="/public/ui-styles/${style}\\.css[^"]*"[^>]*data-wj-style-owner=`).test(html.slice(0, split))) {
        problems.push(`${path}: ${style}.css is in <head> with no owner, so it would outlive the page`);
      }
    }
    // Every copy of a sheet is matched again, so each is linked once, and a
    // link left in the body was not hoisted (it did not lead its template).
    for (const style of linked(body)) problems.push(`${path}: links ${style}.css in its body`);
    for (const m of html.slice(0, split).matchAll(/href="(\/public\/[^"?]+\.css)/g)) {
      if (html.slice(0, split).split(`href="${m[1]}`).length > 2) problems.push(`${path}: links ${m[1]} twice`);
    }
    // A frame is a page of its own, so it links only what it renders.
    if (frame) for (const style of head) if (!used.has(style)) problems.push(`${path}: links ${style}.css and renders no .style-${style}`);
  }
  assert.ok(rendered > 180, `rendered ${rendered} pages`);
  assert.deepEqual(problems, []);
});
