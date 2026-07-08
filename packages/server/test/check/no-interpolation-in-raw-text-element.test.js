/**
 * Tests for the no-interpolation-in-raw-text-element rule (#845). A `${...}`
 * hole inside a `<style>` or `<script>` element renders at SSR but the client
 * parser drops it (a raw-text hole is a noop), so the element paints then wipes
 * to empty on hydration. The rule flags it; static raw-text elements and holes
 * OUTSIDE the raw-text element must not be flagged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkConventions } from '../../src/check.js';

async function appWith(rel, contents) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-rawtext-'));
  const filePath = join(dir, rel);
  await mkdir(filePath.slice(0, filePath.lastIndexOf('/')), { recursive: true });
  await writeFile(filePath, contents);
  return dir;
}
const find = (vs, file) =>
  vs.filter((v) => v.rule === 'no-interpolation-in-raw-text-element' && v.file.includes(file));

test('flags an interpolated <style> child', async () => {
  const dir = await appWith('components/bad.ts', `
import { WebComponent, html } from '@webjsdev/core';
const STYLE = '.x{color:red}';
export class Bad extends WebComponent {
  render() { return html\`<style>\${STYLE}</style><div>hi</div>\`; }
}
Bad.register('bad-el');
`);
  try {
    const v = find(await checkConventions(dir), 'bad.ts');
    assert.equal(v.length, 1, 'interpolated <style> must be flagged once');
    assert.ok(v[0].message.includes('style'), 'message names the element');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('flags an interpolated <script> child', async () => {
  const dir = await appWith('components/scr.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Scr extends WebComponent {
  render() { const n = 1; return html\`<script>const x = \${n};</script>\`; }
}
Scr.register('scr-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'scr.ts').length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does NOT flag a static <style> plus a hole outside the raw-text element', async () => {
  const dir = await appWith('components/good.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Good extends WebComponent {
  render() { return html\`<style>.y{color:blue}</style><div>\${'hi'}</div>\`; }
}
Good.register('good-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'good.ts').length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does NOT flag a page that interpolates a css result into <style> (pages never hydrate)', async () => {
  const dir = await appWith('app/dashboard/page.ts', `
import { html, css } from '@webjsdev/core';
const STYLES = css\`.page-dashboard { color: red; }\`;
export default function Dashboard() {
  return html\`<style>\${STYLES.text}</style><div class="page-dashboard">hi</div>\`;
}
`);
  try {
    assert.equal(find(await checkConventions(dir), 'page.ts').length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('does NOT flag an interpolated <style> inside a comment', async () => {
  const dir = await appWith('components/cmt.ts', `
import { WebComponent, html } from '@webjsdev/core';
// example of what NOT to do: html\`<style>\${x}</style>\`
export class Cmt extends WebComponent {
  render() { return html\`<div>ok</div>\`; }
}
Cmt.register('cmt-el');
`);
  try {
    assert.equal(find(await checkConventions(dir), 'cmt.ts').length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
