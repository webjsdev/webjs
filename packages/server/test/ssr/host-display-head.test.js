/**
 * The framework defaults component hosts to display:block via ONE low-specificity
 * rule injected into every page's <head>: `:where([data-wj-host]) { display:
 * block }`. A custom element is display:inline by default (both light and shadow
 * DOM), which collapses a component used as a block container. The zero-
 * specificity `:where()` keeps it fully overridable by any author style.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequestHandler } from '../../src/dev.js';

const HTML_URL = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), '../../../core/src/html.js')).toString();

let dir;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'webjs-host-head-'));
  mkdirSync(join(dir, 'app'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fx', type: 'module', imports: { '#*': './*' } }));
  writeFileSync(join(dir, 'app', 'layout.ts'),
    `import { html } from '${HTML_URL}';\nexport default ({ children }) => html\`\${children}\`;\n`);
  writeFileSync(join(dir, 'app', 'page.ts'),
    `import { html } from '${HTML_URL}';\nexport default () => html\`<h1>ok</h1>\`;\n`);
});
after(() => rmSync(dir, { recursive: true, force: true }));

test('the document head carries the low-specificity host display default', async () => {
  const h = await createRequestHandler({ appDir: dir, dev: false });
  if (h.warmup) await h.warmup();
  const res = await h.handle(new Request('http://localhost/'));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<style[^>]*>:where\(\[data-wj-host\]\)\{display:block\}<\/style>/, 'head has the host default rule');
  // It sits in <head>, before <body>.
  assert.ok(html.indexOf('data-wj-host') < html.indexOf('<body'), 'rule is in the head');
});
