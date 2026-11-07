/**
 * The /ui docs shell at phone width, shadcn parity (#1666): the title row
 * keeps only the previous and next arrows below sm, a callout's inline code
 * stays in its sentence, and every docs code block carries a copy button.
 * The browser half (nothing wider than 390px) is
 * test/e2e/ui-phone-overflow.test.mjs; the elements' behaviour is in
 * test/components/browser/docs-copy-{page,code}.test.js.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { renderToString } from '@webjsdev/core/server';
import { html } from '@webjsdev/core';
import { callout } from '#lib/ui/docs/callout.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let page: (path: string) => Promise<string>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  page = async (path) => {
    const res = await app.handle(new Request('http://localhost' + path));
    assert.equal(res.status, 200, path);
    return res.text();
  };
});

/** The docs title row: the h1 and the controls beside it. */
const titleRow = (doc: string) => doc.match(/<h1 class="scroll-m-24[\s\S]*?<\/h1>\s*<div class="docs-nav[\s\S]*?(?=<p data-slot="docs-description"|<div data-slot="docs-body")/)?.[0] ?? '';

test('below sm the title row holds only the arrows, as shadcn\'s does', async () => {
  const row = titleRow(await page('/ui/docs/components/dropdown-menu'));
  assert.ok(row, 'the title row');
  // Copy Page and its menu sit in shadcn's `hidden sm:block`.
  assert.match(row, /<div class="hidden sm:block">\s*<docs-copy-page href="\/ui\/llm\/docs\/components\/dropdown-menu" url="https:\/\/[^"]+\/ui\/docs\/components\/dropdown-menu"/);
  // No markdown button beside the arrows: View as Markdown is in the menu.
  assert.doesNotMatch(row, /title="View as Markdown"/);
  assert.match(row, /<a href="[^"]+" data-slot="button"[^>]*><svg[\s\S]*?<span class="sr-only">Previous<\/span>/);
});

test('Copy Page is in the server HTML, with a markdown link for scripting off', async () => {
  const row = titleRow(await page('/ui/docs/components/button'));
  // The host is not hidden waiting for its definition: the first paint has it.
  assert.match(row, /<docs-copy-page href="[^"]+" url="[^"]+"[^>]*>/);
  assert.doesNotMatch(row.match(/<docs-copy-page[^>]*>/)?.[0] ?? '', /hidden|:defined/);
  assert.match(row, /<button type="button" data-slot="button" class="[^"]*noscript:hidden[^"]*"\s*>[\s\S]*?Copy Page/);
  // With scripting off the copy button and the menu give way to a link.
  assert.match(row, /<a href="\/ui\/llm\/docs\/components\/button" target="_blank" rel="noopener" data-slot="button" class="[^"]*hidden[^"]*noscript:inline-flex[^"]*">[\s\S]*?View as Markdown<\/a>/);
  assert.match(row, /id="docs-copy-page-menu" data-slot="button" class="[^"]*noscript:hidden/);
});

test('a titled code block shows its language icon, as shadcn\'s does', async () => {
  const ts = await renderToString(codeFigure('x', { title: 'components/a.ts' }));
  assert.match(ts, /<figcaption data-rehype-pretty-code-title[^>]*>\s*<svg[^>]*class="fill-foreground"><path d="M1\.125 0C/, 'the TypeScript mark');
  const json = await renderToString(codeFigure('{}', { title: 'registry.json', lang: 'json' }));
  assert.match(json, /<figcaption[^>]*>\s*<svg[^>]*><path fill="currentColor" d="M12\.043 23\.968/, 'the JSON mark');
  const css = await renderToString(codeFigure('a{}', { title: 'styles/globals.css', lang: 'css' }));
  assert.match(css, /<figcaption[^>]*>\s*<svg[^>]*class="fill-foreground"><path d="M0 0v20\.16/, 'the CSS mark');
  // The extension decides when no language is passed; anything else is a file.
  assert.match(await renderToString(codeFigure('{}', { title: 'registry.json' })), /d="M12\.043 23\.968/);
  assert.match(await renderToString(codeFigure('A=1', { title: '.env', lang: 'text' })), /<path d="M15 2H6a2 2 0 0 0-2 2v16/, 'lucide file');
  // An untitled block has no caption, so no icon.
  assert.doesNotMatch(await renderToString(codeFigure('x')), /<figcaption/);
});

test('the Copy Page menu offers the page as markdown and to ChatGPT and Claude', async () => {
  const row = titleRow(await page('/ui/docs/components/button'));
  assert.match(row, /<ui-dropdown-menu trigger="docs-copy-page-menu"/);
  assert.match(row, /<a href="\/ui\/llm\/docs\/components\/button" target="_blank"[^>]*>[\s\S]*?View as Markdown<\/a>/);
  assert.match(row, /href="https:\/\/chatgpt\.com\?q=[^"]*WebJs%20UI%20documentation%3A%20https%3A%2F%2F[^"]*%2Fui%2Fdocs%2Fcomponents%2Fbutton/);
  assert.match(row, /href="https:\/\/claude\.ai\/new\?q=/);
});

test('a callout wraps a bare run of text and inline code in one paragraph', async () => {
  // The description is a grid, so unwrapped text and <code> each took a row.
  const inline = await renderToString(callout(html`For example, <code>primary</code> pairs with <code>primary-foreground</code>.`));
  assert.match(inline, /data-slot="alert-description"[^>]*>\s*<p>For example, <code>primary<\/code> pairs with <code>primary-foreground<\/code>\.<\/p>/);
  // A body that brings its own block is left alone, never a <p> in a <p>.
  const block = await renderToString(callout(html`<p><strong>Note:</strong> one <code>x</code>.</p>`));
  assert.doesNotMatch(block, /<p>\s*<p>/);
  assert.match(block, /data-slot="alert-description"[^>]*>\s*<p><strong>Note:<\/strong>/);
  const doc = await page('/ui/docs/theming');
  assert.match(doc, /<p>The background suffix is omitted for the surface token\. For example, <code>primary<\/code>/);
});

test('every docs code block carries a copy button, and a block viewer\'s code does not', async () => {
  const fig = await renderToString(codeFigure('const a = 1;'));
  assert.match(fig, /<docs-copy-code data-slot="copy-button" variant="code" class="absolute top-3 right-2 z-10 hidden \[&amp;:defined\]:block"/);
  assert.doesNotMatch(await renderToString(codeFigure('x', { copy: false })), /docs-copy-code/);

  const doc = await page('/ui/docs/components/button');
  const figures = doc.match(/<figure data-rehype-pretty-code-figure[\s\S]*?<\/figure>/g) ?? [];
  assert.ok(figures.length >= 5, 'the page has its code blocks');
  for (const f of figures) assert.match(f, /<docs-copy-code data-slot="copy-button"/, 'each figure has one');
  // The package-manager block takes shadcn's command placement.
  assert.match(doc, /<docs-copy-code data-slot="copy-button" variant="command" class="absolute top-2 right-2/);
  // The code is in the HTML once, readable with JS off; the button reads it.
  assert.doesNotMatch(doc, /<docs-copy-code[^>]*\bvalue=/);

  // The block viewer draws its own copy buttons.
  const blocks = await page('/ui/blocks/login');
  assert.doesNotMatch(blocks, /<docs-copy-code/);
});
