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
  assert.deepEqual(stylesFor('/ui/preview/preview'), [], 'the configurator frame links its own');
});

test('the home and section pages keep their styles', () => {
  assert.deepEqual(stylesFor('/ui'), ['luma', 'new-york', 'rhea']);
  assert.deepEqual(stylesFor('/ui/blocks/sidebar'), ['luma', 'new-york']);
  assert.deepEqual(stylesFor('/ui/colors'), ['luma', 'new-york']);
  assert.deepEqual(stylesFor('/ui/sera'), ['new-york', 'sera']);
});

test('ui.css carries no kit style; each is its own sheet', () => {
  const ui = readFileSync(resolve(WEBSITE_ROOT, 'public/ui-input.css'), 'utf8');
  assert.doesNotMatch(ui, /scoped\/style-[a-z-]+\.css/, 'ui-input.css imports no style');
  const build = readFileSync(resolve(WEBSITE_ROOT, 'scripts/build-ui-styles.mjs'), 'utf8');
  for (const name of ['new-york', 'nova']) {
    assert.match(build, new RegExp(`'${name}'`), `build-ui-styles.mjs builds ${name}`);
  }
});

/** The pathnames to render: every /ui page, and the frames pages embed. */
async function uiPaths(): Promise<string[]> {
  const pages = await listUiPages('http://localhost');
  const paths = new Set(pages.map((p) => p.path));
  // Every registry block, the charts included, as the block pages frame them.
  const registry = JSON.parse(readFileSync(resolve(WEBSITE_ROOT, '../packages/ui/packages/registry/registry.json'), 'utf8')) as { items: { name: string; type: string }[] };
  for (const item of registry.items) if (item.type === 'registry:block') paths.add(`/ui/view/${item.name}`);
  for (const n of ['preview', 'preview-02', 'preview-03']) { paths.add(`/ui/preview/${n}`); paths.add(`/ui/view/${n}`); }
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

test('every /ui page and frame links the sheet of every style it renders', async () => {
  const paths = await uiPaths();
  assert.ok(paths.length > 200, `the page list is the whole section (${paths.length})`);
  const problems: string[] = [];
  let rendered = 0;
  for (const path of paths) {
    const res = await handle(path);
    if (res.status !== 200) continue;
    rendered++;
    const html = await res.text();
    const split = html.indexOf('</head>');
    const head = html.slice(0, split);
    const body = html.slice(split);
    const used = wrappers(body);
    const all = linked(html);
    const frame = path.startsWith('/ui/preview/') || path.startsWith('/ui/view/');
    for (const style of used) {
      if (!all.has(style)) problems.push(`${path}: renders .style-${style} and links no ${style}.css`);
      // A page reached by a full load paints its first frame from <head>; a
      // chrome page reached by a soft navigation has only its own markup.
      // The frames are full loads only, and the configurator frame names its
      // style in the query, so it links that one from its body.
      else if (!frame && !head.includes(`/public/ui-styles/${style}.css`)) problems.push(`${path}: ${style}.css is not in <head>`);
      else if (!frame && !linked(body).has(style)) problems.push(`${path}: ${style}.css is not in the page's own markup (a soft navigation would miss it)`);
    }
  }
  assert.ok(rendered > 120, `rendered ${rendered} pages`);
  assert.deepEqual(problems, []);
});
