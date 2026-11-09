/**
 * `routeModuleBrowserHints` (#1686): a page, layout or boundary runs only on
 * the server, so code in one that looks meant for the browser silently does
 * nothing. These hints feed `webjs status` and the `ROUTE_BROWSER_CODE`
 * doctor advisory. Each case pins one pattern, and its negative pins the
 * shape that must stay quiet, since an advisory that fires on healthy code
 * trains the reader to skip it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { routeModuleBrowserHints } from '../../src/client-signals.js';

const APP = '/srv/app';
const FILE = `${APP}/app/page.ts`;
const ctx = (extra = {}) => ({
  file: FILE,
  appDir: APP,
  isComponent: (abs) => abs.includes('/components/'),
  ...extra,
});
const hints = (src, extra) => routeModuleBrowserHints(src, ctx(extra));

test('a browser global in code is hinted', () => {
  const h = hints("import { html } from '@webjsdev/core';\nconst w = window.innerWidth;\nexport default () => html`<p>${w}</p>`;");
  assert.equal(h.length, 1);
  assert.match(h[0], /^`window` is used, but this module runs only on the server/);
  assert.match(h[0], /instrumentation-client\.ts/);
});

test('a browser global inside a template hole is code, so it is hinted', () => {
  const h = hints("import { html } from '@webjsdev/core';\nexport default () => html`<p>${document.title}</p>`;");
  assert.equal(h.length, 1);
  assert.match(h[0], /`document`/);
});

test('a browser global in template TEXT is not hinted: an inline script runs from the HTML', () => {
  assert.deepEqual(
    hints("import { html } from '@webjsdev/core';\nexport default () => html`<script>document.title = 'x';</script>`;"),
    [],
  );
});

test('a browser global named in a string or a comment is not hinted', () => {
  assert.deepEqual(
    hints("// reads window size in the component instead\nconst icon = 'lucide-app-window';\nexport default () => icon;"),
    [],
  );
});

test('the client-router import is hinted', () => {
  const h = hints("import '@webjsdev/core/client-router';\nexport default () => null;");
  assert.equal(h.length, 1);
  assert.match(h[0], /`@webjsdev\/core\/client-router` is imported, but this module never loads in a browser/);
});

test('a reactive primitive import is hinted, a plain core import is not', () => {
  const h = hints("import { html, signal } from '@webjsdev/core';\nconst n = signal(0);\nexport default () => html`${n.get()}`;");
  assert.equal(h.length, 1);
  assert.match(h[0], /^`signal` is imported, but this module never hydrates/);
  assert.deepEqual(hints("import { html, notFound } from '@webjsdev/core';\nexport default () => html`<p></p>`;"), []);
});

test('a bare npm side-effect import is hinted, a binding import is not', () => {
  const h = hints("import 'chart-polyfill';\nexport default () => null;");
  assert.equal(h.length, 1);
  assert.match(h[0], /The side-effect import of `chart-polyfill` runs only on the server/);
  assert.deepEqual(hints("import dayjs from 'dayjs';\nexport default () => dayjs().format();"), []);
});

test('a local helper side-effect import is hinted', () => {
  const h = hints("import '../lib/track.ts';\nexport default () => null;");
  assert.equal(h.length, 1);
  assert.match(h[0], /The side-effect import of `\.\.\/lib\/track\.ts` runs only on the server/);
});

test('a side-effect import of a component is how a page registers it, so it is not hinted', () => {
  assert.deepEqual(hints("import '../components/counter.ts';\nexport default () => null;"), []);
});

test('a barrel that leads to a component is not hinted', () => {
  const barrel = `${APP}/modules/ui/elements.ts`;
  const src = "import '../modules/ui/elements.ts';\nexport default () => null;";
  assert.equal(hints(src).length, 1, 'without carriesComponent the barrel reads as a plain helper');
  assert.deepEqual(hints(src, { carriesComponent: (abs) => abs === barrel }), [],
    'its components load in the page\'s place, so the import does its job');
});

test('a server file, a stylesheet and a framework or node: import are never hinted', () => {
  assert.deepEqual(hints([
    "import '../lib/db.server.ts';",
    "import './page.css';",
    "import '@webjsdev/server';",
    "import 'node:process';",
    'export default () => null;',
  ].join('\n')), []);
});

test('`import type` is erased, so it is never hinted', () => {
  assert.deepEqual(hints("import type { Signal } from '@webjsdev/core';\nimport type { X } from 'chart-polyfill';\nexport default () => null;"), []);
});
