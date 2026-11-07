/**
 * No /ui page serves a duplicate or empty element id (#1666). A duplicate id
 * breaks every reference to it: `aria-labelledby` / `aria-controls` /
 * `<label for>` resolve to the first match, and a fragment link jumps to the
 * wrong place. Two shapes reached the docs pages: a component that builds its
 * ids in `connectedCallback` (which never runs on the server) served
 * `id="-heading"` once per command group, and that is exactly the kind of bug
 * a per-component test misses, so this crawls every /ui page the llms index
 * lists and checks the served document as a whole.
 *
 * Template content is skipped: an inert `<template>` and a declarative shadow
 * root are separate id scopes from the document.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { listUiPages } from '#lib/ui/llm.server.ts';
import { parseHtml, type Element } from '#lib/html-to-markdown.ts';

const WEBSITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
let handle: (path: string) => Promise<Response>;

before(async () => {
  const app = await createRequestHandler({ appDir: WEBSITE_ROOT, dev: false });
  await app.warmup?.();
  handle = async (path) => app.handle(new Request('http://localhost' + path));
});

/** Every id in the document scope, in order, template content excluded. */
function documentIds(root: Element): string[] {
  const out: string[] = [];
  const walk = (el: Element) => {
    if ('id' in el.attrs) out.push(el.attrs.id);
    if (el.tag === 'template') return;
    for (const child of el.children) if (typeof child !== 'string') walk(child);
  };
  walk(root);
  return out;
}

/** The ids that appear more than once, and whether any is empty. */
export function idProblems(html: string): { duplicates: string[]; empty: number } {
  const ids = documentIds(parseHtml(html));
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dup.add(id);
    seen.add(id);
  }
  return { duplicates: [...dup].sort(), empty: ids.filter((id) => id.trim() === '').length };
}

test('the check sees a duplicate, an empty id, and ignores template content and comments', () => {
  assert.deepEqual(idProblems('<p id="a"></p><div><span id="a"></span></div>'), { duplicates: ['a'], empty: 0 });
  assert.deepEqual(idProblems('<p id=""></p>'), { duplicates: [], empty: 1 });
  assert.deepEqual(
    idProblems('<p id="a"></p><template><p id="a"></p></template><!-- <p id="a"> -->'),
    { duplicates: [], empty: 0 },
  );
});

test('no /ui page serves a duplicate or an empty id', async () => {
  const pages = await listUiPages('http://localhost');
  assert.ok(pages.length > 50, `the llms index lists the /ui pages (${pages.length})`);
  const failures: string[] = [];
  for (const { path } of pages) {
    const res = await handle(path);
    if (res.status !== 200) {
      failures.push(`${path}: status ${res.status}`);
      continue;
    }
    const { duplicates, empty } = idProblems(await res.text());
    if (duplicates.length) failures.push(`${path}: duplicate ${duplicates.map((d) => `"${d}"`).join(', ')}`);
    if (empty) failures.push(`${path}: ${empty} empty id(s)`);
  }
  assert.deepEqual(failures, []);
});
