/**
 * Unit tests for the SSR code highlighter (lib/highlight.ts).
 *
 * highlight() turns a plain code string into themed token spans at server
 * render time. These tests render the result with renderToString and assert
 * on the produced HTML: the token classes are correct, and code text is HTML
 * escaped (the whole reason samples live in plain strings rather than inside
 * an html`` body is that backticks, angle brackets, and ${...} pass through
 * untouched and escaped).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { html } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';
import { highlight } from '../../lib/highlight.ts';

const render = (code: string) => renderToString(html`<pre>${highlight(code)}</pre>`);

test('keywords and strings get their token classes', async () => {
  const out = await render("import { html } from '@webjsdev/core';");
  assert.match(out, /<span class="t-kw">import<\/span>/);
  assert.match(out, /<span class="t-kw">from<\/span>/);
  assert.match(out, /<span class="t-str">'@webjsdev\/core'<\/span>/);
  assert.match(out, /<span class="t-id">html<\/span>/);
});

test('a call expression is classified as a function', async () => {
  const out = await render('renderToString(html)');
  assert.match(out, /<span class="t-fn">renderToString<\/span>/);
  // `html` here is not followed by `(`, so it stays a plain identifier.
  assert.match(out, /<span class="t-id">html<\/span>/);
});

test('capitalized identifiers are classified as types', async () => {
  const out = await render('class StudentCard extends WebComponent {');
  assert.match(out, /<span class="t-type">StudentCard<\/span>/);
  assert.match(out, /<span class="t-type">WebComponent<\/span>/);
  assert.match(out, /<span class="t-kw">class<\/span>/);
});

test('comments and numbers get their token classes', async () => {
  const out = await render('// hello world\nconst x = 1');
  assert.match(out, /<span class="t-com">\/\/ hello world<\/span>/);
  assert.match(out, /<span class="t-num">1<\/span>/);
});

test('code text is HTML escaped (no injection, backticks and ${} survive)', async () => {
  const out = await render('const t = html`<div>${x}</div> & <b>`;');
  // Angle brackets and ampersand are escaped inside the string token.
  assert.match(out, /&lt;div&gt;/);
  assert.match(out, /&amp;/);
  assert.match(out, /&lt;b&gt;/);
  // No raw element ever lands in the output, so a sample can never inject markup.
  assert.ok(!out.includes('<div>'), 'no raw <div> injected');
  assert.ok(!out.includes('<b>'), 'no raw <b> injected');
  // The ${...} interpolation is literal text, left intact.
  assert.ok(out.includes('${x}'), '${x} survives as literal text');
});

test('leading and trailing blank lines are trimmed', async () => {
  const out = await render('\n\nconst x\n\n');
  assert.equal(out, '<pre><span class="t-kw">const</span> <span class="t-id">x</span></pre>');
});
