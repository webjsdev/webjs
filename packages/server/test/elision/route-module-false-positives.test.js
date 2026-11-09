/**
 * Regression tests for #623: three analyser checks produced FALSE POSITIVES on
 * page/layout (route) modules, pinning `page.ts` / `layout.ts` to the browser
 * even though they never hydrate. Each test pairs the fixed behaviour with a
 * counterfactual proving the guard still fires on genuine client work.
 *
 *   A. `#`-alias side-effect imports were read as bare npm packages.
 *   B. module-scope `new Set/Map(...)` data constants were read as side effects.
 *   C. inline-`<script>` client globals in a route template were read as
 *      module client work.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeElision } from '../../src/component-elision.js';

const INTERACTIVE = `
import { WebComponent, html } from '@webjsdev/core';
class Counter extends WebComponent {
  render() { return html\`<button @click=\${() => {}}>+</button>\`; }
}
Counter.register('x-counter');
`;

function graphOf(edges) {
  const g = new Map();
  for (const [from, tos] of Object.entries(edges)) g.set(from, new Set(tos));
  return g;
}

function run({ files, components = [], routeModules, edges = {}, appDir = '/app' }) {
  return analyzeElision(components, routeModules, graphOf(edges), async (f) => files[f], appDir);
}

const verdict = (r, f) =>
  r.inertRouteModules.has(f) ? 'inert' : r.importOnlyRouteModules.has(f) ? 'import-only' : 'ships';

// ---------------------------------------------------------------------------
// A. `#`-alias side-effect imports
// ---------------------------------------------------------------------------

test('A: a page side-effect-importing a component via a `#` alias is import-only', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const r = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.equal(verdict(r, '/app/page.js'), 'import-only', '# alias import must not pin the page');
});

test('A counterfactual: a page side-effect-importing a real npm package still ships', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    import 'some-npm-polyfill';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const r = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.equal(verdict(r, '/app/page.js'), 'ships', 'a genuine npm side-effect import must still pin the page');
});

test('A: a `#` alias mapped (via package.json imports) to a real package still ships', async () => {
  // The general path: an alias that resolves to a BARE package is flagged; one
  // that resolves to a local file is not. Uses a real appDir so the imports map
  // is read.
  const dir = await mkdtemp(join(tmpdir(), 'webjs-elision-'));
  try {
    await writeFile(join(dir, 'package.json'), JSON.stringify({
      imports: { '#local/*': './*', '#vendored': 'some-real-package' },
    }));
    await mkdir(join(dir, 'components'), { recursive: true });
    await writeFile(join(dir, 'components', 'counter.js'), INTERACTIVE);
    const localPage = `import '#local/components/counter.js';\nexport default () => null;`;
    const vendorPage = `import '#local/components/counter.js';\nimport '#vendored';\nexport default () => null;`;
    await writeFile(join(dir, 'local-page.js'), localPage);
    await writeFile(join(dir, 'vendor-page.js'), vendorPage);
    const files = {
      [join(dir, 'local-page.js')]: localPage,
      [join(dir, 'vendor-page.js')]: vendorPage,
      [join(dir, 'components', 'counter.js')]: INTERACTIVE,
    };
    const r = await run({
      files,
      components: [{ tag: 'x-counter', file: join(dir, 'components', 'counter.js') }],
      routeModules: [join(dir, 'local-page.js'), join(dir, 'vendor-page.js')],
      edges: {
        [join(dir, 'local-page.js')]: [join(dir, 'components', 'counter.js')],
        [join(dir, 'vendor-page.js')]: [join(dir, 'components', 'counter.js')],
      },
      appDir: dir,
    });
    assert.equal(verdict(r, join(dir, 'local-page.js')), 'import-only', 'local-resolving alias is not a package');
    assert.equal(verdict(r, join(dir, 'vendor-page.js')), 'ships', 'alias mapped to a real package still ships');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// B. module-scope `new Set/Map(...)` data constants
// ---------------------------------------------------------------------------

test('B: a page importing a util with a module-scope `new Set([...])` is import-only', async () => {
  const util = `export const TIER_2 = new Set(['a', 'b', 'c']);
export const RE = new RegExp('^x');
export function tierOf(n) { return TIER_2.has(n) ? 2 : 1; }`;
  const page = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    import { tierOf } from '#lib/tier.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const r = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE, '/app/lib/tier.js': util },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js', '/app/lib/tier.js'] },
  });
  assert.equal(verdict(r, '/app/page.js'), 'import-only', 'a pure-data `new Set` util must not pin the page');
});

test('B: a module-scope `new Intl.DateTimeFormat(...)` formatter does not pin the page', async () => {
  // An agent building an app on the scaffold hoisted a date formatter to module
  // scope in a shared helper, and every page importing it shipped (and then
  // failed no-server-import-in-browser-module through the helper's other import).
  const util = `const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
const money = new Intl
  .NumberFormat('en', { style: 'currency', currency: 'EUR' });
export function when(d) { return fmt.format(d); }
export function price(n) { return money.format(n); }`;
  const page = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    import { when } from '#lib/format.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const r = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE, '/app/lib/format.js': util },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js', '/app/lib/format.js'] },
  });
  assert.equal(verdict(r, '/app/page.js'), 'import-only', 'an Intl formatter is inert module data');
});

test('B counterfactual: a dotted constructor outside the list still ships', async () => {
  const util = `export const chan = new Foo.BroadcastChannel('x');
export function post(m) { chan.postMessage(m); }`;
  const page = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    import { post } from '#lib/chan.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const r = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE, '/app/lib/chan.js': util },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js', '/app/lib/chan.js'] },
  });
  assert.equal(verdict(r, '/app/page.js'), 'ships');
});

test('B: a page computing module-scope data with pure builtins still elides', async () => {
  // Three of three agents building a booking app wrote the HOURS line on a page
  // that imported a server module, and the page was reported as shipping.
  const page = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    const HOURS = Array.from({ length: 24 }, (_, h) => h);
    const LIMIT = Math.max(1, Number('3'));
    const DAYS = Object.freeze(['Mon', 'Tue']);
    const DEFAULTS = JSON.parse('{"a":1}');
    export default () => html\`<x-counter></x-counter>\${HOURS.length}\${LIMIT}\${DAYS}\${DEFAULTS.a}\`;
  `;
  const r = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.equal(verdict(r, '/app/page.js'), 'import-only', 'pure builtin calls are module data');
});

for (const [label, line] of [
  ['a user function', 'const HOURS = buildHours();'],
  ['a user function inside the Array.from callback', 'const HOURS = Array.from({ length: 3 }, (_, i) => track(i));'],
  ['a same-named method on another object', 'const HOURS = api.from(3);'],
  ['a timer', 'setInterval(() => {}, 1000);'],
]) {
  test(`B counterfactual: ${label} at module scope still ships the page`, async () => {
    const page = `
      import { html } from '@webjsdev/core';
      import '#components/counter.js';
      ${line}
      export default () => html\`<x-counter></x-counter>\`;
    `;
    const r = await run({
      files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
      components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
      routeModules: ['/app/page.js'],
      edges: { '/app/page.js': ['/app/components/counter.js'] },
    });
    assert.equal(verdict(r, '/app/page.js'), 'ships');
  });
}

test('B counterfactual: a util with a module-scope `new WebSocket()` still ships the page', async () => {
  const util = `export const sock = new WebSocket('ws://localhost');
export function send(m) { sock.send(m); }`;
  const page = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    import { send } from '#lib/live.js';
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const r = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE, '/app/lib/live.js': util },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js', '/app/lib/live.js'] },
  });
  assert.equal(verdict(r, '/app/page.js'), 'ships', 'a real `new WebSocket()` side effect must still pin the page');
});

// ---------------------------------------------------------------------------
// C. inline-`<script>` client globals in a route template
// ---------------------------------------------------------------------------

test('C: a layout whose template has an inline <script> using document is import-only', async () => {
  const layout = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    export default ({ children }) => html\`
      <script>
        (function () {
          var t = localStorage.getItem('theme');
          if (t) document.documentElement.dataset.theme = t;
          document.addEventListener('click', function () {});
        })();
      </script>
      <x-counter></x-counter>
      \${children}
    \`;
  `;
  const r = await run({
    files: { '/app/layout.js': layout, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/layout.js'],
    edges: { '/app/layout.js': ['/app/components/counter.js'] },
  });
  assert.equal(verdict(r, '/app/layout.js'), 'import-only', 'inline-script globals in a template must not pin the layout');
});

test('C counterfactual: a layout with a module-scope document access still ships', async () => {
  const layout = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    document.title = 'set at module load';
    export default ({ children }) => html\`<x-counter></x-counter>\${children}\`;
  `;
  const r = await run({
    files: { '/app/layout.js': layout, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/layout.js'],
    edges: { '/app/layout.js': ['/app/components/counter.js'] },
  });
  assert.equal(verdict(r, '/app/layout.js'), 'ships', 'a real module-scope document access must still pin the layout');
});

// ---------------------------------------------------------------------------
// D. code samples containing framework imports / reactive primitives
// ---------------------------------------------------------------------------

test('D: a page with code samples containing framework imports/reactives is import-only', async () => {
  const page = `
    import { html } from '@webjsdev/core';
    import '#components/counter.js';
    const sample1 = "import { signal } from '@webjsdev/core';";
    const sample2 = \`
      import { signal } from '@webjsdev/core';
      const c = signal(0);
    \`;
    export default () => html\`<x-counter></x-counter>\`;
  `;
  const r = await run({
    files: { '/app/page.js': page, '/app/components/counter.js': INTERACTIVE },
    components: [{ tag: 'x-counter', file: '/app/components/counter.js' }],
    routeModules: ['/app/page.js'],
    edges: { '/app/page.js': ['/app/components/counter.js'] },
  });
  assert.equal(verdict(r, '/app/page.js'), 'import-only', 'code samples must not pin the page');
});

