/**
 * Regression tests for #623: three analyser checks produced FALSE POSITIVES,
 * first found on page/layout modules. A route module never ships since #1686,
 * so these heuristics now decide one thing only, whether a COMPONENT ships,
 * and each case below is the same code moved into a display-only component.
 * A false positive there over-ships a module the browser did not need. Each
 * test pairs the fixed behaviour with a counterfactual proving the guard still
 * fires on genuine client work.
 *
 *   A. `#`-alias side-effect imports were read as bare npm packages.
 *   B. module-scope `new Set/Map(...)` data constants were read as side effects.
 *   C. inline-`<script>` client globals in a template were read as module
 *      client work.
 *   D. code samples in strings were read as real imports.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeElision } from '../../src/component-elision.js';

/** A display-only component carrying `top` at module scope and `body` in its template. */
const badge = (top, body = '') => `import { WebComponent, html } from '@webjsdev/core';
${top}
class Badge extends WebComponent {
  render() { return html\`<span class="badge">verified</span>${body}\`; }
}
Badge.register('x-badge');`;

const BADGE = '/app/components/badge.js';

/** The badge's verdict, with `utils` as modules it imports. */
async function verdict(src, utils = {}, appDir = '/app', file = BADGE) {
  const files = { [file]: src, ...utils };
  const graph = new Map([[file, new Set(Object.keys(utils))]]);
  for (const u of Object.keys(utils)) graph.set(u, new Set());
  const r = await analyzeElision([{ tag: 'x-badge', file, className: 'Badge' }], graph, async (f) => files[f], appDir);
  return r.elidableComponents.has(file) ? 'elided' : 'ships';
}

// ---------------------------------------------------------------------------
// A. `#`-alias side-effect imports
// ---------------------------------------------------------------------------

test('A: a component side-effect-importing a local module via a `#` alias stays display-only', async () => {
  assert.equal(
    await verdict(badge("import '#lib/setup.js';"), { '/app/lib/setup.js': 'export const x = 1;' }),
    'elided', '# alias import must not read as an npm package');
});

test('A counterfactual: a component side-effect-importing a real npm package ships', async () => {
  assert.equal(await verdict(badge("import 'some-npm-polyfill';")), 'ships',
    'a genuine npm side-effect import runs on load');
});

test('A: a `#` alias mapped (via package.json imports) to a real package ships', async () => {
  // The general path: an alias that resolves to a BARE package is flagged; one
  // that resolves to a local file is not. Uses a real appDir so the imports map
  // is read.
  const dir = await mkdtemp(join(tmpdir(), 'webjs-elision-'));
  try {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      imports: { '#local/*': './*', '#vendored': 'some-real-package' },
    }));
    await mkdir(join(dir, 'components'), { recursive: true });
    // The alias sits in a helper the component imports, where the closure rule
    // reads the helper's side-effect imports through the app's imports map.
    const file = join(dir, 'components', 'badge.js');
    const util = join(dir, 'lib', 'setup.js');
    const src = badge("import '../lib/setup.js';");
    assert.equal(await verdict(src, { [util]: "import '#local/lib/other.js';\nexport const x = 1;" }, dir, file), 'elided',
      'local-resolving alias is not a package');
    assert.equal(await verdict(src, { [util]: "import '#vendored';\nexport const x = 1;" }, dir, file), 'ships',
      'alias mapped to a real package ships');
    // The component's own import reads the same imports map, so it ships too.
    assert.equal(await verdict(badge("import '#vendored';"), {}, dir, file), 'ships',
      "the component's own alias to a real package ships");
    assert.equal(await verdict(badge("import '#local/lib/other.js';"), {}, dir, file), 'elided',
      "the component's own local-resolving alias stays display-only");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// B. module-scope data constants and pure builtin calls
// ---------------------------------------------------------------------------

test('B: a component importing a util with a module-scope `new Set([...])` stays display-only', async () => {
  const util = `export const TIER_2 = new Set(['a', 'b', 'c']);
export const RE = new RegExp('^x');
export function tierOf(n) { return TIER_2.has(n) ? 2 : 1; }`;
  assert.equal(await verdict(badge("import { tierOf } from '#lib/tier.js';"), { '/app/lib/tier.js': util }),
    'elided', 'a pure-data `new Set` util must not ship the component');
});

test('B: a module-scope `new Intl.DateTimeFormat(...)` formatter is inert data', async () => {
  // An agent building an app on the scaffold hoisted a date formatter to module
  // scope in a shared helper, and every module importing it was judged to ship.
  const util = `const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
const money = new Intl
  .NumberFormat('en', { style: 'currency', currency: 'EUR' });
export function when(d) { return fmt.format(d); }
export function price(n) { return money.format(n); }`;
  assert.equal(await verdict(badge("import { when } from '#lib/format.js';"), { '/app/lib/format.js': util }),
    'elided', 'an Intl formatter is inert module data');
});

test('B counterfactual: a dotted constructor outside the list ships', async () => {
  const util = `export const chan = new Foo.BroadcastChannel('x');
export function post(m) { chan.postMessage(m); }`;
  assert.equal(await verdict(badge("import { post } from '#lib/chan.js';"), { '/app/lib/chan.js': util }), 'ships');
});

test('B: module-scope data computed with pure builtins stays display-only', async () => {
  // Three of three agents building a booking app wrote the HOURS line.
  const top = `const HOURS = Array.from({ length: 24 }, (_, h) => h);
const LIMIT = Math.max(1, Number('3'));
const DAYS = Object.freeze(['Mon', 'Tue']);
const DEFAULTS = JSON.parse('{"a":1}');`;
  assert.equal(await verdict(badge(top)), 'elided', 'pure builtin calls are module data');
});

for (const [label, line] of [
  ['a user function', 'const HOURS = buildHours();'],
  ['a user function inside the Array.from callback', 'const HOURS = Array.from({ length: 3 }, (_, i) => track(i));'],
  ['a same-named method on another object', 'const HOURS = api.from(3);'],
  ['a timer', 'setInterval(() => {}, 1000);'],
]) {
  test(`B counterfactual: ${label} at module scope ships the component`, async () => {
    assert.equal(await verdict(badge(line)), 'ships');
  });
}

test('B counterfactual: a util with a module-scope `new WebSocket()` ships the component', async () => {
  const util = `export const sock = new WebSocket('ws://localhost');
export function send(m) { sock.send(m); }`;
  assert.equal(await verdict(badge("import { send } from '#lib/live.js';"), { '/app/lib/live.js': util }),
    'ships', 'a real `new WebSocket()` side effect must still ship it');
});

// ---------------------------------------------------------------------------
// C. inline-`<script>` client globals in a template
// ---------------------------------------------------------------------------

test('C: an inline <script> using document in a template is not module client work', async () => {
  const script = `<script>(function () {
    var t = localStorage.getItem('theme');
    if (t) document.documentElement.dataset.theme = t;
    document.addEventListener('click', function () {});
  })();</script>`;
  assert.equal(await verdict(badge('', script)), 'elided',
    'inline-script globals in a template run from the HTML, not from loading the module');
});

test('C counterfactual: a module-scope document access ships', async () => {
  assert.equal(await verdict(badge("document.title = 'set at module load';")), 'ships',
    'a real module-scope document access must still ship it');
});

// ---------------------------------------------------------------------------
// D. code samples containing framework imports / reactive primitives
// ---------------------------------------------------------------------------

test('D: code samples containing framework imports/reactives are not imports', async () => {
  const top = `const sample1 = "import { signal } from '@webjsdev/core';";
const sample2 = \`
  import { signal } from '@webjsdev/core';
  const c = signal(0);
\`;`;
  assert.equal(await verdict(badge(top)), 'elided', 'code samples must not ship the component');
});
